// Server-only helpers for diagnosing the ElevenLabs credential chain and
// replaying any post-call webhook payloads that could not be verified.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { persistPostCall, type PostCallData } from "@/routes/api.public.elevenlabs.postcall";

const EL_BASE = "https://api.elevenlabs.io/v1";

export interface CredentialCheck {
  ok: boolean;
  label: string;
  detail: string;
  hint?: string;
}

/** Mask a secret so it can be shown in the UI without leaking the value. */
function maskSecret(value: string): string {
  const prefix = value.slice(0, 3);
  const suffix = value.slice(-4);
  return `${prefix}…${suffix} (${value.length} chars)`;
}

/**
 * Probe the saved ElevenLabs API key against a harmless read-only endpoint.
 * Never returns the key itself — only a masked fingerprint.
 */
export async function checkElevenLabsApiKey(): Promise<CredentialCheck> {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) {
    return {
      ok: false,
      label: "ElevenLabs API key",
      detail: "No key is saved.",
      hint: "Add an ElevenLabs API key so transcripts can be verified and recovered.",
    };
  }

  const masked = maskSecret(key);

  try {
    // Probe the actual Conversational AI endpoints we rely on, not /user,
    // so missing user_read permission does not create a false alarm.
    const [settingsRes, conversationsRes] = await Promise.all([
      fetch(`${EL_BASE}/convai/settings`, { headers: { "xi-api-key": key } }),
      fetch(`${EL_BASE}/convai/conversations?page_size=1`, { headers: { "xi-api-key": key } }),
    ]);

    if (settingsRes.ok || conversationsRes.ok) {
      return {
        ok: true,
        label: "ElevenLabs API key",
        detail: `Connected — Conversational AI accessible. Key ${masked}.`,
      };
    }

    const settingsText = await settingsRes.text();
    const conversationsText = await conversationsRes.text();
    const bodyText = settingsText || conversationsText;

    let message = bodyText.slice(0, 300);
    try {
      const json = JSON.parse(bodyText) as { detail?: { message?: string; status?: string } | string };
      if (typeof json.detail === "string") message = json.detail;
      else if (json.detail?.message) message = json.detail.message;
    } catch {
      /* keep raw text */
    }

    return {
      ok: false,
      label: "ElevenLabs API key",
      detail: `Rejected (HTTP ${settingsRes.status} / ${conversationsRes.status}): ${message}. Key ${masked}.`,
      hint: key.startsWith("sk_")
        ? "The key has the right shape but ElevenLabs is refusing it. In ElevenLabs → API Keys, make sure it has permissions for Conversational AI (at least user_read, convai:read, and voices:read)."
        : "This key does not start with sk_, which is the current ElevenLabs API key format.",
    };
  } catch (e) {
    return {
      ok: false,
      label: "ElevenLabs API key",
      detail: `Could not reach ElevenLabs: ${e instanceof Error ? e.message : String(e)}. Key ${masked}.`,
    };
  }
}

/**
 * Report on the webhook signing secret. ElevenLabs has no endpoint to verify a
 * signing secret, so we report whether it is present plus how many recent
 * incoming calls failed their signature check.
 */
export async function checkWebhookSecret(): Promise<CredentialCheck> {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET?.trim();
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { count } = await supabaseAdmin
    .from("webhook_failures")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  const failures = count ?? 0;

  if (!secret) {
    return {
      ok: false,
      label: "Webhook signing secret",
      detail: "No signing secret is saved, so every call falls back to API verification.",
      hint: "Copy the signing secret from ElevenLabs → Workspace → Webhooks.",
    };
  }

  if (failures > 0) {
    return {
      ok: false,
      label: "Webhook signing secret",
      detail: `Saved (${maskSecret(secret)}), but ${failures} call(s) in the last 7 days failed verification.`,
      hint: "The saved signing secret likely does not match the one in ElevenLabs → Workspace → Webhooks. Failed calls are stored and can be replayed below.",
    };
  }

  return {
    ok: true,
    label: "Webhook signing secret",
    detail: `Saved (${maskSecret(secret)}). No verification failures in the last 7 days.`,
  };
}

export interface WebhookFailureRow {
  id: string;
  reason: string;
  conversationId: string | null;
  agentId: string | null;
  createdAt: string;
  replayedAt: string | null;
  replayResult: string | null;
}

export async function listWebhookFailures(limit = 50): Promise<WebhookFailureRow[]> {
  const { data } = await supabaseAdmin
    .from("webhook_failures")
    .select("id, reason, elevenlabs_conversation_id, elevenlabs_agent_id, created_at, replayed_at, replay_result")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id: r.id,
    reason: r.reason,
    conversationId: r.elevenlabs_conversation_id,
    agentId: r.elevenlabs_agent_id,
    createdAt: r.created_at,
    replayedAt: r.replayed_at,
    replayResult: r.replay_result,
  }));
}

/**
 * Turn stored, unverified payloads into real threads. Runs silently so
 * customers never get a text about a call that already happened.
 */
export async function replayWebhookFailures(): Promise<{
  attempted: number;
  saved: number;
  duplicate: number;
  errors: number;
}> {
  const { data: rows } = await supabaseAdmin
    .from("webhook_failures")
    .select("id, payload, elevenlabs_conversation_id, elevenlabs_agent_id")
    .is("replayed_at", null)
    .order("created_at", { ascending: true })
    .limit(200);

  let saved = 0;
  let duplicate = 0;
  let errors = 0;

  for (const row of rows ?? []) {
    const data = row.payload as unknown as PostCallData;
    const elAgentId = row.elevenlabs_agent_id ?? data?.agent_id;
    const conversationId = row.elevenlabs_conversation_id ?? data?.conversation_id;
    let result = "error";
    if (!elAgentId || !conversationId) {
      errors++;
      result = "missing-ids";
    } else {
      try {
        const r = await persistPostCall(elAgentId, conversationId, data, { silent: true });
        result = r.status;
        if (r.status === "ok") saved++;
        else if (r.status === "duplicate") duplicate++;
        else errors++;
      } catch (e) {
        errors++;
        result = e instanceof Error ? e.message.slice(0, 200) : "error";
      }
    }

    const shouldMarkDone = result === "ok" || result === "duplicate" || result === "missing-ids";
    await supabaseAdmin
      .from("webhook_failures")
      .update({
        replay_result: result,
        ...(shouldMarkDone ? { replayed_at: new Date().toISOString() } : {}),
      })
      .eq("id", row.id);
  }

  return { attempted: (rows ?? []).length, saved, duplicate, errors };
}
