// Server-only helper: pull recent completed conversations from ElevenLabs
// and persist any that the post-call webhook missed (e.g. while the webhook
// URL was misconfigured). Safe to re-run — uses the same idempotency key.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { persistPostCall, type PostCallData } from "@/routes/api.public.elevenlabs.postcall";

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
  metadata?: PostCallData["metadata"];
}

/**
 * Backfill recent completed calls for a single ElevenLabs agent_id.
 * Returns counts so the caller can report progress.
 */
export async function backfillRecentCalls(opts: {
  elAgentId: string;
  pageSize?: number;
}): Promise<{ scanned: number; saved: number; skipped: number; errors: number }> {
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
  const items = (listJson.conversations ?? []).filter((c) => (c.status ?? "done") === "done");

  let saved = 0;
  let skipped = 0;
  let errors = 0;

  // Skip ids we already stored.
  const ids = items.map((c) => c.conversation_id);
  const existingSet = new Set<string>();
  if (ids.length > 0) {
    const { data: existing } = await supabaseAdmin
      .from("conversations")
      .select("elevenlabs_conversation_id")
      .in("elevenlabs_conversation_id", ids);
    for (const row of existing ?? []) {
      if (row.elevenlabs_conversation_id) existingSet.add(row.elevenlabs_conversation_id);
    }
  }

  for (const item of items) {
    if (existingSet.has(item.conversation_id)) {
      skipped++;
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
      const result = await persistPostCall(opts.elAgentId, item.conversation_id, {
        agent_id: detail.agent_id ?? opts.elAgentId,
        conversation_id: detail.conversation_id ?? item.conversation_id,
        status: detail.status,
        transcript: detail.transcript,
        metadata: detail.metadata ?? {
          start_time_unix_secs: item.start_time_unix_secs,
          call_duration_secs: item.call_duration_secs,
        },
      });
      if (result.status === "ok") saved++;
      else if (result.status === "duplicate") skipped++;
      else errors++;
    } catch (e) {
      errors++;
      console.error("backfill: error for", item.conversation_id, e);
    }
  }

  return { scanned: items.length, saved, skipped, errors };
}
