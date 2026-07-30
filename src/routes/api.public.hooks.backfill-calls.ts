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
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { backfillRecentCalls } = await import("@/server/voice-call-backfill.server");

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
          JSON.stringify({ success: true, scanned, saved, skipped, errors, recovered }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
