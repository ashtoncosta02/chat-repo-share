import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { captureLead } from "@/server/lead-extraction";

const EL_BASE = "https://api.elevenlabs.io/v1";

/**
 * ElevenLabs post-call webhook.
 * Configured in ElevenLabs dashboard → Workspace → Webhooks.
 * Signature header: `ElevenLabs-Signature: t=<unix>,v0=<hex hmac sha256>`
 *
 * Persists every completed phone call as a `conversations` row + `messages`
 * rows, then runs lead extraction so the call shows up under Leads too.
 */
export const Route = createFileRoute("/api/public/elevenlabs/postcall")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.ELEVENLABS_WEBHOOK_SECRET?.trim();
        const signature = request.headers.get("elevenlabs-signature");
        const rawBody = await request.text();

        let signatureTrusted = false;
        if (secret) {
          if (!signature) {
            console.warn("postcall: missing signature; will verify via ElevenLabs API");
          } else {
            const headerParts = signature.split(",").map((p) => p.trim());
            const ts = headerParts.find((p) => p.startsWith("t="))?.slice(2);
            const sigPart = headerParts.find((p) => p.startsWith("v0="));
            const sig = sigPart?.slice(3);
            if (!ts || !sig) {
              console.warn("postcall: bad signature parts; will verify via ElevenLabs API");
            } else {
              const ageSec = Math.abs(Date.now() / 1000 - Number(ts));
              if (!Number.isFinite(ageSec) || ageSec > 1800) {
                console.warn("postcall: stale signature; will verify via ElevenLabs API", ageSec);
              } else {
                const expected = createHmac("sha256", secret)
                  .update(`${ts}.${rawBody}`)
                  .digest("hex");
                const a = Buffer.from(sig, "hex");
                const b = Buffer.from(expected, "hex");
                signatureTrusted = a.length === b.length && timingSafeEqual(a, b);
                if (!signatureTrusted) {
                  console.warn("postcall: invalid signature; will verify via ElevenLabs API");
                }
              }
            }
          }
        }

        let payload: PostCallPayload;
        try {
          payload = JSON.parse(rawBody) as PostCallPayload;
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        // Only handle transcription events. Audio + failure events ack OK so
        // EL doesn't retry, but they don't write transcripts.
        const eventType = payload.type ?? "post_call_transcription";
        if (eventType !== "post_call_transcription") {
          return new Response(`ok-skip-${eventType}`, { status: 200 });
        }

        let data = payload.data ?? (payload as unknown as PostCallData);
        let elAgentId = data.agent_id;
        const conversationId = data.conversation_id;
        if (!elAgentId || !conversationId) {
          console.warn("postcall: missing agent_id or conversation_id");
          return new Response("Missing fields", { status: 400 });
        }

        // If the saved HMAC secret is wrong, do not drop the call. Verify the
        // conversation exists in ElevenLabs with our API key, then persist the
        // canonical transcript returned by ElevenLabs. This keeps the endpoint
        // authenticated without burning more customer call credits.
        if (secret && !signatureTrusted) {
          const verified = await fetchElevenLabsConversation(conversationId);
          if (!verified || verified.agent_id !== elAgentId) {
            console.warn("postcall: fallback verification failed", conversationId);
            return new Response("Invalid signature", { status: 401 });
          }
          data = verified;
          elAgentId = verified.agent_id;
        }

        const result = await persistPostCall(elAgentId, conversationId, data);
        if (result.status === "agent-not-found") {
          console.warn("postcall: agent not found for", elAgentId);
          return new Response("ok-no-agent", { status: 200 });
        }
        if (result.status === "duplicate") {
          return new Response("ok-dup", { status: 200 });
        }
        if (result.status === "db-error") {
          return new Response("db-error", { status: 500 });
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});

export interface PostCallPayload {
  type?: string;
  event_timestamp?: number;
  data?: PostCallData;
}

export interface PostCallData {
  agent_id?: string;
  conversation_id?: string;
  status?: string;
  transcript?: Array<{
    role?: string;
    message?: string;
    text?: string;
    time_in_call_secs?: number;
  }>;
  metadata?: {
    start_time_unix_secs?: number;
    call_duration_secs?: number;
    phone_call?: { external_number?: string; agent_number?: string };
  };
  conversation_initiation_client_data?: {
    dynamic_variables?: Record<string, string>;
  };
}

type PersistResult =
  | { status: "ok"; conversationDbId: string }
  | { status: "duplicate" }
  | { status: "agent-not-found" }
  | { status: "db-error" };

/**
 * Persist a single post-call payload: insert conversation + messages,
 * then trigger lead extraction. Idempotent by elevenlabs_conversation_id.
 * Exported so the manual backfill server function can reuse it.
 */
export async function persistPostCall(
  elAgentId: string,
  conversationId: string,
  data: PostCallData,
): Promise<PersistResult> {
  const { data: agent, error: agentErr } = await supabaseAdmin
    .from("agents")
    .select("id, user_id")
    .eq("elevenlabs_agent_id", elAgentId)
    .maybeSingle();
  if (agentErr || !agent) {
    return { status: "agent-not-found" };
  }

  const { data: existing } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("elevenlabs_conversation_id", conversationId)
    .maybeSingle();
  if (existing) return { status: "duplicate" };

  const startedAt = data.metadata?.start_time_unix_secs
    ? new Date(data.metadata.start_time_unix_secs * 1000).toISOString()
    : new Date().toISOString();
  const durationSec = Math.max(0, Math.round(data.metadata?.call_duration_secs ?? 0));
  const endedAt = new Date(
    new Date(startedAt).getTime() + durationSec * 1000,
  ).toISOString();

  const transcriptArr = Array.isArray(data.transcript) ? data.transcript : [];
  const cleanedTurns = transcriptArr
    .map((t) => ({
      role: t.role === "agent" ? "assistant" : "user",
      content: String(t.message ?? t.text ?? "").trim(),
    }))
    .filter((t) => t.content.length > 0);
  const messageCount = cleanedTurns.length;

  const { data: convo, error: convoErr } = await supabaseAdmin
    .from("conversations")
    .insert({
      user_id: agent.user_id,
      agent_id: agent.id,
      elevenlabs_conversation_id: conversationId,
      started_at: startedAt,
      ended_at: endedAt,
      duration_seconds: durationSec,
      message_count: messageCount,
    })
    .select("id")
    .single();

  if (convoErr || !convo) {
    console.error("postcall: insert conversation failed", convoErr);
    return { status: "db-error" };
  }

  if (cleanedTurns.length > 0) {
    const rows = cleanedTurns.map((t) => ({
      user_id: agent.user_id,
      conversation_id: convo.id,
      role: t.role,
      content: t.content,
    }));
    const { error: msgErr } = await supabaseAdmin.from("messages").insert(rows);
    if (msgErr) console.error("postcall: insert messages failed", msgErr);
  }

  // Lead extraction — uses the caller's phone (from EL metadata) as a
  // fallback when the AI can't pull a phone from the transcript.
  const fallbackPhone =
    data.metadata?.phone_call?.external_number?.trim() || null;

  const userTurns = cleanedTurns.filter((t) => t.role === "user");
  // Only extract a lead if the caller actually said something — otherwise
  // we'd create empty leads for hangups / no-answers.
  if (userTurns.length > 0 || fallbackPhone) {
    await captureLead({
      agentId: agent.id,
      userId: agent.user_id,
      conversationId: convo.id,
      source: "voice",
      fallbackPhone,
      messages: cleanedTurns as { role: "user" | "assistant"; content: string }[],
    });
  }

  console.log(
    `postcall: saved conversation ${convo.id} (${messageCount} messages) for agent ${agent.id}`,
  );
  return { status: "ok", conversationDbId: convo.id };
}
