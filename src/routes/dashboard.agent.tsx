import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/agent")({
  head: () => ({ meta: [{ title: "Agent — Ask Janice" }] }),
  component: AgentRedirect,
});

function AgentRedirect() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("agents")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.id) {
        navigate({ to: "/dashboard/agents/$agentId", params: { agentId: data.id }, replace: true });
      } else {
        navigate({ to: "/dashboard/onboarding", replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, navigate]);

  return <div className="p-8 text-center text-muted-foreground">Loading agent…</div>;
}
