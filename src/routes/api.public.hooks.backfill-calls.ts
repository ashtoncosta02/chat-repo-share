import { createFileRoute } from "@tanstack/react-router";

/**
 * Hourly safety net for the ElevenLabs post-call webhook.
 *
 * If a post-call webhook request is ever dropped (network blip, bad signature,
 * provider retry exhaustion) the call would otherwise never appear in the app.
 * This sweep pulls the recent conversation list for every connected voice agent
 * and persists anything the app is missing. It is idempotent — calls that are
 * already stored are skipped.
 */
export const Route = createFileRoute("/api/public/hooks/backfill-calls")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorizeCronRequest } = await import("@/server/cron-auth.server");
        const denied = await authorizeCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { backfillRecentCalls } = await import("@/server/voice-call-backfill.server");
        const { checkElevenLabsApiKey, replayWebhookFailures } = await import(
          "@/server/webhook-health.server"
        );
        const { sendEmail } = await import("@/server/email.server");

        // 1. Self-check the voice credentials before anything else. A rejected
        // API key is the single failure that can silently stop calls from
        // landing in Threads, so alert the owner (at most once per 6h).
        const credential = await checkElevenLabsApiKey();
        if (!credential.ok) {
          const sixHoursAgo = new Date(Date.now() - 6 * 3600_000).toISOString();
          const { count } = await supabaseAdmin
            .from("email_send_log")
            .select("id", { count: "exact", head: true })
            .eq("template_name", "voice-credential-alert")
            .gte("created_at", sixHoursAgo);
          if ((count ?? 0) === 0) {
            const messageId = await sendEmail({
              to: "hello@askjanice.net",
              subject: "Janice alert: voice credentials are not working",
              html: `<p>The automated health check could not use the ElevenLabs credentials.</p>
<p><strong>${credential.label}:</strong> ${credential.detail}</p>
${credential.hint ? `<p>${credential.hint}</p>` : ""}
<p>Calls are still being parked and can be replayed from Admin &rarr; System health once this is fixed.</p>`,
            }).catch(() => null);
            await supabaseAdmin.from("email_send_log").insert({
              message_id: messageId,
              template_name: "voice-credential-alert",
              recipient_email: "hello@askjanice.net",
              status: messageId ? "sent" : "failed",
              metadata: { detail: credential.detail } as unknown as never,
            });
          }
        }

        // 2. Drain anything parked by a failed webhook verification.
        const replay = await replayWebhookFailures();

        const { data: agents, error } = await supabaseAdmin
          .from("agents")
          .select("id, elevenlabs_agent_id")
          .not("elevenlabs_agent_id", "is", null);


        if (error) {
          console.error("backfill-sweep: could not load agents:", error.message);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let scanned = 0;
        let saved = 0;
        let skipped = 0;
        let errors = 0;
        const recovered: Array<{ agent_id: string; saved: number }> = [];

        for (const agent of agents ?? []) {
          const elAgentId = agent.elevenlabs_agent_id;
          if (!elAgentId) continue;
          try {
            const r = await backfillRecentCalls({ elAgentId, pageSize: 30 });
            scanned += r.scanned;
            saved += r.saved;
            skipped += r.skipped;
            errors += r.errors;
            if (r.saved > 0) {
              recovered.push({ agent_id: agent.id, saved: r.saved });
              console.warn(
                `backfill-sweep: recovered ${r.saved} missed call(s) for agent ${agent.id} — the post-call webhook did not deliver them`,
              );
            }
          } catch (e) {
            errors++;
            console.error("backfill-sweep: failed for agent", agent.id, e);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            credentials: { ok: credential.ok, detail: credential.detail },
            replay,
            scanned,
            saved,
            skipped,
            errors,
            recovered,
          }),
          { headers: { "Content-Type": "application/json" } },
        );

      },
    },
  },
});
