// Server-only helper: pull recent completed conversations from ElevenLabs
// and persist any that the post-call webhook missed (e.g. while the webhook
// URL was misconfigured). Safe to re-run — uses the same idempotency key.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { persistPostCall, type PostCallData } from "@/routes/api.public.elevenlabs.postcall";
import { callerNumberFrom } from "@/lib/caller-number";

const EL_BASE = "https://api.elevenlabs.io/v1";

interface ConversationListItem {
  conversation_id: string;
  agent_id: string;
  start_time_unix_secs?: number;
  call_duration_secs?: number;
  message_count?: number;
  status?: string;
}

interface ConversationDetail {
  agent_id: string;
  conversation_id: string;
  status?: string;
  transcript?: PostCallData["transcript"];
  metadata?: PostCallData["metadata"] & { termination_reason?: string };
  conversation_initiation_client_data?: PostCallData["conversation_initiation_client_data"];
}

export interface FailedCallNote {
  conversationId: string;
  elAgentId: string;
  startUnix: number | null;
  terminationReason: string | null;
  leadSaved: boolean;
}

/**
 * Backfill recent completed calls for a single ElevenLabs agent_id.
 * Returns counts so the caller can report progress.
 */
export async function backfillRecentCalls(opts: {
  elAgentId: string;
  pageSize?: number;
}): Promise<{
  scanned: number;
  saved: number;
  skipped: number;
  errors: number;
  leadsRecovered: number;
  leadRecoveryFailures: FailedCallNote[];
  recentFailed: FailedCallNote[];
}> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");
  const pageSize = Math.min(Math.max(opts.pageSize ?? 30, 1), 100);

  const listRes = await fetch(
    `${EL_BASE}/convai/conversations?agent_id=${encodeURIComponent(opts.elAgentId)}&page_size=${pageSize}`,
    { headers: { "xi-api-key": apiKey } },
  );
  if (!listRes.ok) {
    throw new Error(`EL list conversations failed (${listRes.status}): ${await listRes.text()}`);
  }
  const listJson = (await listRes.json()) as { conversations?: ConversationListItem[] };
  // "failed" conversations are real callers too (e.g. dropped mid-call).
  const items = (listJson.conversations ?? []).filter((c) => {
    const st = c.status ?? "done";
    return st === "done" || st === "failed";
  });
  const leadsRecoveredRef = { n: 0 };
  const leadRecoveryFailures: FailedCallNote[] = [];
  const recentFailed: FailedCallNote[] = [];
  const nowSec = Date.now() / 1000;
  const fetchDetail = async (id: string): Promise<ConversationDetail | null> => {
    const r = await fetch(`${EL_BASE}/convai/conversations/${encodeURIComponent(id)}`, { headers: { "xi-api-key": apiKey } });
    if (!r.ok) {
      console.error(`backfill: detail fetch failed for ${id} (${r.status})`);
      return null;
    }
    return (await r.json()) as ConversationDetail;
  };

  let saved = 0;
  let skipped = 0;
  let errors = 0;

  // Skip ids we already stored.
  const ids = items.map((c) => c.conversation_id);
  const existingSet = new Set<string>();
  const deletedSet = new Set<string>();
  const existingRows = new Map<string, { id: string; lead_id: string | null; agent_id: string | null; user_id: string }>();
  if (ids.length > 0) {
    const { data: existing } = await supabaseAdmin
      .from("conversations")
      .select("id, lead_id, agent_id, user_id, elevenlabs_conversation_id")
      .in("elevenlabs_conversation_id", ids);
    for (const row of existing ?? []) {
      if (row.elevenlabs_conversation_id) {
        existingSet.add(row.elevenlabs_conversation_id);
        existingRows.set(row.elevenlabs_conversation_id, row);
      }
    }
    // Calls the owner deleted must never be re-imported.
    const { data: deleted } = await supabaseAdmin
      .from("deleted_voice_calls")
      .select("elevenlabs_conversation_id")
      .in("elevenlabs_conversation_id", ids);
    for (const row of deleted ?? []) {
      existingSet.add(row.elevenlabs_conversation_id);
      deletedSet.add(row.elevenlabs_conversation_id);
    }
  }

  for (const item of items) {
    const isFailed = item.status === "failed";
    const recentFail = isFailed && !!item.start_time_unix_secs && nowSec - item.start_time_unix_secs < 3 * 3600;
    if (deletedSet.has(item.conversation_id)) {
      skipped++;
      continue;
    }
    if (existingSet.has(item.conversation_id)) {
      skipped++;
      const row = existingRows.get(item.conversation_id);
      const within72h = !!item.start_time_unix_secs && nowSec - item.start_time_unix_secs < 72 * 3600;
      let leadSaved = !!row?.lead_id;
      let fetched: ConversationDetail | null = null;
      // Saved conversation whose lead never landed: recover it silently.
      if (row && !row.lead_id && row.agent_id && within72h) {
        try {
          const detail = await fetchDetail(item.conversation_id);
          fetched = detail;
          if (detail) {
            const turns = (detail.transcript ?? [])
              .map((t) => ({ role: (t.role === "agent" ? "assistant" : "user") as "user" | "assistant", content: String(t.message ?? t.text ?? "").trim() }))
              .filter((t) => t.content.length > 0);
            const phone = callerNumberFrom(detail);
            if (turns.some((t) => t.role === "user") || phone) {
              const { captureLead } = await import("@/server/lead-extraction");
              const r = await captureLead({
                agentId: row.agent_id,
                userId: row.user_id,
                conversationId: row.id,
                source: detail.metadata?.sms ? "sms" : "voice",
                fallbackPhone: phone,
                messages: turns,
              });
              if (r.ok && r.leadId) {
                leadsRecoveredRef.n++;
                leadSaved = true;
              } else {
                leadRecoveryFailures.push({ conversationId: item.conversation_id, elAgentId: opts.elAgentId, startUnix: item.start_time_unix_secs ?? null, terminationReason: detail.metadata?.termination_reason ?? null, leadSaved: false });
              }
            }
          }
        } catch (e) {
          console.error("backfill: lead recovery failed for", item.conversation_id, e);
        }
      }
      if (recentFail) {
        if (!fetched) fetched = await fetchDetail(item.conversation_id).catch(() => null);
        recentFailed.push({ conversationId: item.conversation_id, elAgentId: opts.elAgentId, startUnix: item.start_time_unix_secs ?? null, terminationReason: fetched?.metadata?.termination_reason ?? null, leadSaved });
      }
      continue;
    }
    try {
      const detailRes = await fetch(
        `${EL_BASE}/convai/conversations/${encodeURIComponent(item.conversation_id)}`,
        { headers: { "xi-api-key": apiKey } },
      );
      if (!detailRes.ok) {
        errors++;
        console.error(
          `backfill: detail fetch failed for ${item.conversation_id} (${detailRes.status})`,
        );
        continue;
      }
      const detail = (await detailRes.json()) as ConversationDetail;
      const result = await persistPostCall(
        opts.elAgentId,
        item.conversation_id,
        {
          agent_id: detail.agent_id ?? opts.elAgentId,
          conversation_id: detail.conversation_id ?? item.conversation_id,
          status: detail.status,
          transcript: detail.transcript,
          metadata: detail.metadata ?? {
            start_time_unix_secs: item.start_time_unix_secs,
            call_duration_secs: item.call_duration_secs,
          },
          conversation_initiation_client_data: detail.conversation_initiation_client_data,
        },
        // Recovery only backfills history — never re-send owner alerts or
        // text the caller again for a call that already happened.
        { silent: true },
      );
      if (recentFail) {
        let leadSaved = false;
        if (result.status === "ok") {
          const { data: c } = await supabaseAdmin.from("conversations").select("lead_id").eq("id", result.conversationDbId).maybeSingle();
          leadSaved = !!c?.lead_id;
        }
        recentFailed.push({ conversationId: item.conversation_id, elAgentId: opts.elAgentId, startUnix: item.start_time_unix_secs ?? null, terminationReason: detail.metadata?.termination_reason ?? null, leadSaved });
      }
      if (result.status === "ok") saved++;
      else if (result.status === "duplicate") skipped++;
      else errors++;
    } catch (e) {
      errors++;
      console.error("backfill: error for", item.conversation_id, e);
    }
  }

  return { scanned: items.length, saved, skipped, errors, leadsRecovered: leadsRecoveredRef.n, leadRecoveryFailures, recentFailed };
}

/**
 * Leads with no phone and no email that came from an ElevenLabs conversation:
 * look the caller number up again and set only leads.phone. Each lead is tried
 * at most once a week. Sends nothing to anyone.
 */
export async function repairLeadsMissingContact(): Promise<{ checked: number; repaired: number }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { checked: 0, repaired: 0 };
  const { allowRequestStrict } = await import("@/server/rate-limit.server");
  const { data: leads, error } = await supabaseAdmin
    .from("leads")
    .select("id")
    .is("phone", null)
    .is("email", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("repairLeadsMissingContact: lead lookup failed", error.message);
    return { checked: 0, repaired: 0 };
  }
  const leadIds = (leads ?? []).map((l) => l.id);
  if (leadIds.length === 0) return { checked: 0, repaired: 0 };
  const { data: convs } = await supabaseAdmin
    .from("conversations")
    .select("lead_id, elevenlabs_conversation_id")
    .in("lead_id", leadIds)
    .not("elevenlabs_conversation_id", "is", null)
    .order("started_at", { ascending: false });
  const byLead = new Map<string, string>();
  for (const c of convs ?? []) if (c.lead_id && c.elevenlabs_conversation_id && !byLead.has(c.lead_id)) byLead.set(c.lead_id, c.elevenlabs_conversation_id);

  let checked = 0;
  let repaired = 0;
  for (const [leadId, elId] of byLead) {
    if (checked >= 25) break;
    if (!(await allowRequestStrict(`lead-phone-repair:${leadId}`, 1, 7 * 86400))) continue;
    checked++;
    try {
      const r = await fetch(`${EL_BASE}/convai/conversations/${encodeURIComponent(elId)}`, { headers: { "xi-api-key": apiKey } });
      if (!r.ok) continue;
      const phone = callerNumberFrom((await r.json()) as ConversationDetail);
      if (!phone) continue;
      const { error: updErr } = await supabaseAdmin.from("leads").update({ phone }).eq("id", leadId).is("phone", null);
      if (updErr) console.error("repairLeadsMissingContact: update failed", leadId, updErr.message);
      else repaired++;
    } catch (e) {
      console.error("repairLeadsMissingContact: failed for", leadId, e);
    }
  }
  return { checked, repaired };
}

/**
 * Website chats from the last 72h with 2+ visitor messages but no lead: run
 * lead capture from the saved messages. Sends nothing to anyone.
 */
export async function recoverWidgetLeads(): Promise<{ checked: number; recovered: number }> {
  const since = new Date(Date.now() - 72 * 3600_000).toISOString();
  const { data: threads, error } = await supabaseAdmin
    .from("conversations")
    .select("id, agent_id, user_id")
    .eq("source", "widget")
    .is("lead_id", null)
    .not("agent_id", "is", null)
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("recoverWidgetLeads: lookup failed", error.message);
    return { checked: 0, recovered: 0 };
  }
  const { captureLead } = await import("@/server/lead-extraction");
  let checked = 0;
  let recovered = 0;
  for (const t of threads ?? []) {
    if (checked >= 25) break;
    const { data: msgs } = await supabaseAdmin
      .from("messages")
      .select("role, content")
      .eq("conversation_id", t.id)
      .order("created_at", { ascending: true })
      .limit(200);
    const turns = (msgs ?? [])
      .map((m) => ({ role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant", content: String(m.content ?? "").trim() }))
      .filter((m) => m.content.length > 0);
    if (turns.filter((m) => m.role === "user").length < 2) continue;
    checked++;
    // Existing leads may already point at this thread; captureLead dedupes.
    const r = await captureLead({ agentId: t.agent_id!, userId: t.user_id, conversationId: t.id, source: "widget", messages: turns });
    if (r.ok && r.leadId) recovered++;
  }
  return { checked, recovered };
}
