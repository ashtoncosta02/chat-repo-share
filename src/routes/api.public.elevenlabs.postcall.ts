import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * ElevenLabs post-call webhook.
 * Configured in ElevenLabs dashboard → Workspace → Webhooks.
 * Signature header: `ElevenLabs-Signature: t=<unix>,v0=<hex hmac sha256>`
 *
 * Persists every completed phone call as a `conversations` row + `messages`
 * rows scoped to the agent owner so it shows up in their dashboard.
 */
export const Route = createFileRoute("/api/public/elevenlabs/postcall")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
        const signature = request.headers.get("elevenlabs-signature");
        const rawBody = await request.text();

        // Signature is optional (controlled by whether the secret is set).
        // Strongly recommended in production.
        if (secret) {
          if (!signature) {
            return new Response("Missing signature", { status: 401 });
          }
          const parts = Object.fromEntries(
            signature.split(",").map((p) => {
              const [k, v] = p.split("=");
              return [k, v];
            }),
          );
          const ts = parts.t;
          const sig = parts.v0;
          if (!ts || !sig) return new Response("Bad signature", { status: 401 });

          // Reject anything older than 5 minutes (replay protection).
          const ageSec = Math.abs(Date.now() / 1000 - Number(ts));
          if (!Number.isFinite(ageSec) || ageSec > 300) {
            return new Response("Stale signature", { status: 401 });
          }

          const expected = createHmac("sha256", secret)
            .update(`${ts}.${rawBody}`)
            .digest("hex");
          const a = Buffer.from(sig);
          const b = Buffer.from(expected);
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response("Invalid signature", { status: 401 });
          }
        }

        let payload: PostCallPayload;
        try {
          payload = JSON.parse(rawBody) as PostCallPayload;
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const data = payload.data ?? (payload as unknown as PostCallData);
        const elAgentId = data.agent_id;
        const conversationId = data.conversation_id;
        if (!elAgentId || !conversationId) {
          return new Response("Missing fields", { status: 400 });
        }

        // Map EL agent_id → our agents row (so we know the owning user).
        const { data: agent, error: agentErr } = await supabaseAdmin
          .from("agents")
          .select("id, user_id")
          .eq("elevenlabs_agent_id", elAgentId)
          .maybeSingle();
        if (agentErr || !agent) {
          console.error("postcall: agent not found for elAgentId", elAgentId, agentErr);
          // Still 200 so EL doesn't retry forever.
          return new Response("ok-no-agent", { status: 200 });
        }

        // Idempotency: skip if we've already stored this conversation.
        const { data: existing } = await supabaseAdmin
          .from("conversations")
          .select("id")
          .eq("elevenlabs_conversation_id", conversationId)
          .maybeSingle();
        if (existing) return new Response("ok-dup", { status: 200 });

        const startedAt = data.metadata?.start_time_unix_secs
          ? new Date(data.metadata.start_time_unix_secs * 1000).toISOString()
          : new Date().toISOString();
        const durationSec = Math.max(0, Math.round(data.metadata?.call_duration_secs ?? 0));
        const endedAt = new Date(
          new Date(startedAt).getTime() + durationSec * 1000,
        ).toISOString();

        const transcriptArr = Array.isArray(data.transcript) ? data.transcript : [];
        const messageCount = transcriptArr.length;

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
          return new Response("db-error", { status: 500 });
        }

        if (messageCount > 0) {
          const rows = transcriptArr
            .filter((t) => t && (t.message || t.text))
            .map((t) => ({
              user_id: agent.user_id,
              conversation_id: convo.id,
              role: t.role === "agent" ? "assistant" : "user",
              content: String(t.message ?? t.text ?? ""),
            }));
          if (rows.length > 0) {
            const { error: msgErr } = await supabaseAdmin.from("messages").insert(rows);
            if (msgErr) console.error("postcall: insert messages failed", msgErr);
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});

interface PostCallPayload {
  type?: string;
  event_timestamp?: number;
  data?: PostCallData;
}

interface PostCallData {
  agent_id?: string;
  conversation_id?: string;
  status?: string;
  transcript?: Array<{ role?: string; message?: string; text?: string; time_in_call_secs?: number }>;
  metadata?: {
    start_time_unix_secs?: number;
    call_duration_secs?: number;
  };
}
