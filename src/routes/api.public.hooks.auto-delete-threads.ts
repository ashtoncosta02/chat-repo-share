import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/auto-delete-threads")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Find every agent that has auto-delete turned on.
        const { data: agents, error: agentsErr } = await supabaseAdmin
          .from("agents")
          .select("id, auto_delete_threads_hours")
          .not("auto_delete_threads_hours", "is", null);

        if (agentsErr) {
          return new Response(
            JSON.stringify({ success: false, error: agentsErr.message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        let totalDeleted = 0;
        const perAgent: Array<{ agent_id: string; deleted: number }> = [];

        for (const agent of agents ?? []) {
          const hours = agent.auto_delete_threads_hours;
          if (!hours || hours <= 0) continue;

          const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

          // Conversations older than cutoff for this agent.
          const { data: oldConvs, error: convErr } = await supabaseAdmin
            .from("conversations")
            .select("id")
            .eq("agent_id", agent.id)
            .lt("started_at", cutoff);

          if (convErr || !oldConvs || oldConvs.length === 0) continue;

          const convIds = oldConvs.map((c) => c.id);

          // Which of those have a lead attached?
          const { data: leads } = await supabaseAdmin
            .from("leads")
            .select("conversation_id")
            .in("conversation_id", convIds);

          const leadIds = new Set((leads ?? []).map((l) => l.conversation_id).filter(Boolean));
          const toDelete = convIds.filter((id) => !leadIds.has(id));
          if (toDelete.length === 0) continue;

          const { error: delErr } = await supabaseAdmin
            .from("conversations")
            .delete()
            .in("id", toDelete);

          if (!delErr) {
            totalDeleted += toDelete.length;
            perAgent.push({ agent_id: agent.id, deleted: toDelete.length });
          }
        }

        return new Response(
          JSON.stringify({ success: true, deleted: totalDeleted, perAgent }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
