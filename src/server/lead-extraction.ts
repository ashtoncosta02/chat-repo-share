// Server-only helper: extract lead/contact info from any conversation
// transcript (widget chat OR voice call) using Lovable AI Gateway, then
// upsert into the `leads` table. Idempotent per (agent_id, conversation_id)
// and dedupes by email when available.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface ExtractedLead {
  name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

export interface CaptureLeadArgs {
  agentId: string;
  userId: string;
  conversationId: string | null;
  source: "widget" | "voice" | "sms";
  // Optional fallback phone (e.g. caller phone number on inbound voice calls)
  // used when the AI cannot extract one from the transcript.
  fallbackPhone?: string | null;
  messages: { role: "user" | "assistant"; content: string }[];
}

export async function extractLeadFromTranscript(
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<ExtractedLead | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  if (messages.length === 0) return null;

  const transcript = messages
    .slice(-30)
    .map((m) => `${m.role === "user" ? "Caller" : "Assistant"}: ${m.content}`)
    .join("\n");

  const system = `You extract lead/contact information from a conversation between a customer and an AI receptionist (chat or phone call).

Return ONLY a JSON object with these keys (all optional, use null if not present):
{
  "name": string | null,
  "phone": string | null,
  "email": string | null,
  "notes": string | null
}

Rules:
- Only extract info the CALLER actually provided. Never invent.
- If nothing identifying was shared, return all nulls.
- "notes": one short sentence summarizing intent (booking, question, pricing, complaint, callback request…).
- Phone numbers may be spoken (e.g. "six four seven, four seven three…") — convert to digits with dashes if obvious.
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

    if (!res.ok) {
      console.error("lead extraction: gateway error", res.status, await res.text().catch(() => ""));
      return null;
    }
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
    console.error("lead extraction error:", e);
    return null;
  }
}

/**
 * Fire-and-forget lead capture for any conversation type.
 * Skips silently on any failure — never block the calling code.
 */
export async function captureLead(args: CaptureLeadArgs): Promise<void> {
  try {
    const lead = await extractLeadFromTranscript(args.messages);
    const phone = lead?.phone ?? args.fallbackPhone ?? null;
    const finalLead: ExtractedLead = {
      name: lead?.name ?? null,
      phone,
      email: lead?.email ?? null,
      notes: lead?.notes ?? null,
    };

    if (!finalLead.name && !finalLead.phone && !finalLead.email && !finalLead.notes) return;

    // Dedupe priority: existing lead for this conversation > email > phone.
    let existingId: string | null = null;
    let existingStatus: string | null = null;
    if (args.conversationId) {
      const { data } = await supabaseAdmin
        .from("leads")
        .select("id, status")
        .eq("agent_id", args.agentId)
        .eq("conversation_id", args.conversationId)
        .maybeSingle();
      if (data?.id) {
        existingId = data.id;
        existingStatus = data.status;
      }
    }
    if (!existingId && finalLead.email) {
      const { data } = await supabaseAdmin
        .from("leads")
        .select("id, status")
        .eq("agent_id", args.agentId)
        .eq("email", finalLead.email)
        .maybeSingle();
      if (data?.id) {
        existingId = data.id;
        existingStatus = data.status;
      }
    }
    if (!existingId && finalLead.phone) {
      const { data } = await supabaseAdmin
        .from("leads")
        .select("id, status")
        .eq("agent_id", args.agentId)
        .eq("phone", finalLead.phone)
        .maybeSingle();
      if (data?.id) {
        existingId = data.id;
        existingStatus = data.status;
      }
    }

    const now = new Date().toISOString();

    if (existingId) {
      const patch: Record<string, unknown> = { last_message_at: now };
      if (finalLead.name) patch.name = finalLead.name;
      if (finalLead.phone) patch.phone = finalLead.phone;
      if (finalLead.email) patch.email = finalLead.email;
      if (finalLead.notes) patch.notes = finalLead.notes;
      // Don't downgrade a "won" lead (booked) back to "new".
      if (existingStatus !== "won" && existingStatus !== "contacted") {
        patch.status = "new";
      }
      await supabaseAdmin.from("leads").update(patch).eq("id", existingId);
    } else {
      await supabaseAdmin.from("leads").insert({
        user_id: args.userId,
        agent_id: args.agentId,
        conversation_id: args.conversationId,
        name: finalLead.name,
        phone: finalLead.phone,
        email: finalLead.email,
        notes: finalLead.notes,
        source: args.source,
        status: "new",
        last_message_at: now,
      });
    }
  } catch (e) {
    console.error("captureLead error:", e);
  }
}
