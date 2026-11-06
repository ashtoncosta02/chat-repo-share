// Server-only helper: extract lead/contact info from any conversation
// transcript (widget chat OR voice call) using Lovable AI Gateway, then
// upsert into the `leads` table. Idempotent per (agent_id, conversation_id)
// and dedupes by email when available.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callerWordsSnippet, mergeLeadNotes } from "@/lib/lead-notes";

export { mergeLeadNotes };

export interface ExtractedLead {
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
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
  // Used as notes when the AI gives none (e.g. "Missed call: ...").
  fallbackNotes?: string | null;
  // A fresh inbound inquiry: re-opens a "contacted" lead as "new".
  newInquiry?: boolean;
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
  "address": string | null,
  "notes": string | null
}

Rules:
- Only extract info the CALLER actually provided. Never invent.
- If nothing identifying was shared, return all nulls.
- "address": street address / service address the caller shared (e.g. "123 Main St, Toronto"). Null if not given.
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
      address: norm(parsed.address),
      notes: norm(parsed.notes),
    };
  } catch (e) {
    console.error("lead extraction error:", e);
    return null;
  }
}

export interface CaptureLeadResult {
  ok: boolean;
  leadId: string | null;
}

/**
 * Lead capture for any conversation type. Never throws.
 * If the caller said anything, a lead is always created or updated — even
 * when the AI is down and no phone number is known.
 */
export async function captureLead(args: CaptureLeadArgs): Promise<CaptureLeadResult> {
  try {
    const callerSpoke = args.messages.some((m) => m.role === "user" && m.content.trim().length > 0);
    let lead: ExtractedLead | null = null;
    try {
      lead = await extractLeadFromTranscript(args.messages);
    } catch (e) {
      console.error("captureLead: extraction failed", e);
    }
    const finalLead: ExtractedLead = {
      name: lead?.name ?? null,
      phone: lead?.phone ?? args.fallbackPhone ?? null,
      email: lead?.email ?? null,
      address: lead?.address ?? null,
      notes: lead?.notes ?? args.fallbackNotes ?? (callerSpoke ? callerWordsSnippet(args.messages) : null),
    };

    if (!callerSpoke && !finalLead.name && !finalLead.phone && !finalLead.email && !finalLead.address && !finalLead.notes) {
      return { ok: true, leadId: null };
    }

    // Dedupe priority: existing lead for this conversation > email > phone.
    let existing: { id: string; status: string | null; notes: string | null } | null = null;
    if (args.conversationId) {
      const { data } = await supabaseAdmin
        .from("leads")
        .select("id, status, notes")
        .eq("agent_id", args.agentId)
        .eq("conversation_id", args.conversationId)
        .order("created_at", { ascending: true })
        .limit(1);
      existing = data?.[0] ?? null;
    }
    if (!existing && finalLead.email) {
      const { data } = await supabaseAdmin
        .from("leads")
        .select("id, status, notes")
        .eq("agent_id", args.agentId)
        .eq("email", finalLead.email)
        .order("created_at", { ascending: true })
        .limit(1);
      existing = data?.[0] ?? null;
    }
    if (!existing && finalLead.phone) {
      const last10 = finalLead.phone.replace(/\D/g, "").slice(-10);
      if (last10.length >= 7) {
        const { data: candidates } = await supabaseAdmin
          .from("leads")
          .select("id, status, notes, phone")
          .eq("agent_id", args.agentId)
          .not("phone", "is", null)
          .order("created_at", { ascending: true });
        const match = (candidates ?? []).find(
          (c) => (c.phone ?? "").replace(/\D/g, "").slice(-10) === last10,
        );
        if (match) existing = { id: match.id, status: match.status, notes: match.notes };
      }
    }

    const now = new Date().toISOString();
    let leadId: string | null = null;

    if (existing) {
      leadId = existing.id;
      const patch: {
        last_message_at: string;
        name?: string;
        phone?: string;
        email?: string;
        address?: string;
        notes?: string;
        status?: string;
      } = { last_message_at: now };
      if (finalLead.name) patch.name = finalLead.name;
      if (finalLead.phone) patch.phone = finalLead.phone;
      if (finalLead.email) patch.email = finalLead.email;
      if (finalLead.address) patch.address = finalLead.address;
      const merged = mergeLeadNotes(finalLead.notes, existing.notes);
      if (merged && merged !== existing.notes) patch.notes = merged;
      // "won" never changes. "contacted" re-opens only on a fresh inquiry.
      if (existing.status !== "won") {
        if (existing.status !== "contacted" || args.newInquiry) patch.status = "new";
      }
      const { error } = await supabaseAdmin.from("leads").update(patch).eq("id", existing.id);
      if (error) {
        console.error("captureLead: lead update failed", error.message);
        return { ok: false, leadId };
      }
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from("leads")
        .insert({
          user_id: args.userId,
          agent_id: args.agentId,
          conversation_id: args.conversationId,
          name: finalLead.name,
          phone: finalLead.phone,
          email: finalLead.email,
          address: finalLead.address,
          notes: finalLead.notes,
          source: args.source,
          status: "new",
          last_message_at: now,
        })
        .select("id")
        .single();
      if (error || !inserted) {
        console.error("captureLead: lead insert failed", error?.message);
        return { ok: false, leadId: null };
      }
      leadId = inserted.id;
    }

    // Link this conversation to the lead so related calls group together.
    if (leadId && args.conversationId) {
      const { error } = await supabaseAdmin
        .from("conversations")
        .update({ lead_id: leadId })
        .eq("id", args.conversationId);
      if (error) console.error("captureLead: conversation link failed", error.message);
    }
    return { ok: true, leadId };
  } catch (e) {
    console.error("captureLead error:", e);
    return { ok: false, leadId: null };
  }
}

/**
 * A caller who could not reach the receptionist (over minutes, no plan, our
 * error). Record them as a lead and tell the owner (max once per caller per
 * hour). Never throws.
 */
export async function saveMissedCaller(opts: {
  agentId: string;
  userId: string;
  callerNumber: string;
  reason: string;
}): Promise<void> {
  try {
    const result = await captureLead({
      agentId: opts.agentId,
      userId: opts.userId,
      conversationId: null,
      source: "voice",
      fallbackPhone: opts.callerNumber,
      fallbackNotes: `Missed call: ${opts.reason}`,
      newInquiry: true,
      messages: [],
    });
    if (!result.ok) console.error("saveMissedCaller: lead not saved");

    const { allowRequestStrict, sha256Hex } = await import("@/server/rate-limit.server");
    const digits = opts.callerNumber.replace(/\D/g, "").slice(-10);
    if (!(await allowRequestStrict(`missed-caller:${opts.agentId}:${sha256Hex(digits)}`, 1, 3600))) return;

    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("notify_email, business_name")
      .eq("id", opts.agentId)
      .maybeSingle();
    let to = agent?.notify_email?.trim() || null;
    if (!to) {
      const { data: prof } = await supabaseAdmin.from("profiles").select("email").eq("user_id", opts.userId).maybeSingle();
      to = prof?.email?.trim() || null;
    }
    if (!to) return;
    const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
    const { sendEmail } = await import("@/server/email.server");
    const { PUBLIC_APP_ORIGIN } = await import("@/lib/app-origin");
    await sendEmail({
      to,
      subject: "A caller could not reach your AI Receptionist",
      html: `<p>${esc(opts.callerNumber)} called ${esc(agent?.business_name || "your business")} but could not reach your receptionist (${esc(opts.reason)}).</p><p>We saved them as a lead so you can call them back.</p><p><a href="${PUBLIC_APP_ORIGIN}/dashboard/leads">Open your leads</a></p>`,
    });
  } catch (e) {
    console.error("saveMissedCaller failed", e);
  }
}
