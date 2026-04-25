import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/widget/config/$agentId")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ params }) => {
        const { data: agent, error } = await supabaseAdmin
          .from("agents")
          .select("id, business_name, assistant_name, tone, is_live")
          .eq("id", params.agentId)
          .maybeSingle();

        if (error || !agent) {
          return new Response(JSON.stringify({ error: "Agent not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({
            id: agent.id,
            businessName: agent.business_name,
            assistantName: agent.assistant_name || "Assistant",
            tone: agent.tone,
            isLive: agent.is_live,
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=60",
            },
          }
        );
      },
    },
  },
});
