// Server-only helper: extract contact info from a widget conversation
// and upsert it into the `leads` table. Idempotent per (agent_id, email|phone).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface CaptureArgs {
  agentId: string;
  userId: string;
  conversationId: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

interface ExtractedLead {
  name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

async function extractWithAI(
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<ExtractedLead | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;

  const transcript = messages
    .slice(-12)
    .map((m) => `${m.role === "user" ? "Visitor" : "Assistant"}: ${m.content}`)
    .join("\n");

  const system = `You extract lead/contact information from a chat between a website visitor and an AI assistant.

Return ONLY a JSON object with these keys (all optional, use null if not present):
{
  "name": string | null,
  "phone": string | null,
  "email": string | null,
  "notes": string | null
}

Rules:
- Only extract info the VISITOR actually provided. Never invent.
- If nothing identifying was shared, return all nulls.
- "notes": one short sentence summarizing intent (booking, question, pricing, complaint…).
- Output valid JSON only. No prose, no markdown fences.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: system },
          { role: "user", content: transcript },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content as string | undefined;
    if (!raw) return null;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return null;
      }
    }

    const norm = (v: unknown): string | null => {
      if (typeof v !== "string") return null;
      const t = v.trim();
      return t.length > 0 && t.toLowerCase() !== "null" ? t : null;
    };

    return {
      name: norm(parsed.name),
      phone: norm(parsed.phone),
      email: norm(parsed.email),
      notes: norm(parsed.notes),
    };
  } catch (e) {
    console.error("widget-lead-capture extract error:", e);
    return null;
  }
}

/**
 * Fire-and-forget lead capture for a widget conversation.
 * Skips silently on any failure — never block the chat reply.
 */
export async function captureLeadFromWidget(args: CaptureArgs): Promise<void> {
  try {
    const lead = await extractWithAI(args.messages);
    if (!lead) return;
    if (!lead.name && !lead.phone && !lead.email) return;

    // Try to dedupe: prefer existing lead matching email or phone for this agent.
    let existingId: string | null = null;
    if (lead.email) {
      const { data } = await supabaseAdmin
        .from("leads")
        .select("id")
        .eq("agent_id", args.agentId)
        .eq("email", lead.email)
        .maybeSingle();
      if (data?.id) existingId = data.id;
    }
    // Note: deduping is by email only (per product decision). Phone numbers
    // are too often shared (households, businesses) to use as a dedup key.
    if (!existingId) {
      // Also dedupe by conversation: don't double-insert for same conversation.
      const { data } = await supabaseAdmin
        .from("leads")
        .select("id")
        .eq("agent_id", args.agentId)
        .eq("conversation_id", args.conversationId)
        .maybeSingle();
      if (data?.id) existingId = data.id;
    }

    const now = new Date().toISOString();

    if (existingId) {
      // Patch with any new info; never overwrite with null.
      const patch: {
        last_message_at: string;
        name?: string;
        phone?: string;
        email?: string;
        notes?: string;
      } = { last_message_at: now };
      if (lead.name) patch.name = lead.name;
      if (lead.phone) patch.phone = lead.phone;
      if (lead.email) patch.email = lead.email;
      if (lead.notes) patch.notes = lead.notes;
      await supabaseAdmin.from("leads").update(patch).eq("id", existingId);
    } else {
      await supabaseAdmin.from("leads").insert({
        user_id: args.userId,
        agent_id: args.agentId,
        conversation_id: args.conversationId,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        notes: lead.notes,
        source: "widget",
        status: "new",
        last_message_at: now,
      });
    }
  } catch (e) {
    console.error("captureLeadFromWidget error:", e);
  }
}
