import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/dashboard/PageHeader";
import { Bot, Calendar, CheckCircle2, MessageSquare, Phone, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({ meta: [{ title: "Dashboard — Agent Factory" }] }),
  component: DashboardHome,
});

interface AgentRow {
  id: string;
  business_name: string;
  assistant_name: string | null;
  industry: string | null;
  is_live: boolean;
  created_at: string;
}

function DashboardHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ conversations: 0, leads: 0, voiceCalls: 0 });
  const [calendarConnected, setCalendarConnected] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: agentRow } = await supabase
        .from("agents")
        .select("id, business_name, assistant_name, industry, is_live, created_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;

      if (!agentRow) {
        // Layout should already redirect, but be defensive.
        navigate({ to: "/dashboard/onboarding" });
        return;
      }
      setAgent(agentRow as AgentRow);

      // Pull lightweight counts in parallel
      const [chats, leads, calls, cal] = await Promise.all([
        supabase
          .from("widget_conversations")
          .select("id", { count: "exact", head: true })
          .eq("agent_id", agentRow.id),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("agent_id", agentRow.id),
        supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .eq("agent_id", agentRow.id),
        supabase
          .from("agent_google_calendar")
          .select("id", { head: true, count: "exact" })
          .eq("agent_id", agentRow.id),
      ]);

      if (cancelled) return;
      setStats({
        conversations: chats.count ?? 0,
        leads: leads.count ?? 0,
        voiceCalls: calls.count ?? 0,
      });
      setCalendarConnected((cal.count ?? 0) > 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, navigate]);

  if (loading || !agent) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Your AI Receptionist" />
        <div className="p-8 text-center text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const assistantName = agent.assistant_name?.trim() || "Ava";

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`${assistantName} is ${agent.is_live ? "live" : "offline"} for ${agent.business_name}`}
      />
      <div className="p-4 md:p-8 space-y-4 md:space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            icon={<MessageSquare className="h-5 w-5 text-[var(--gold)]" />}
            iconBg="bg-[oklch(0.95_0.05_290)]"
            label="Chat conversations"
            value={stats.conversations}
          />
          <StatCard
            icon={<Phone className="h-5 w-5 text-blue-600" />}
            iconBg="bg-blue-100"
            label="Voice calls"
            value={stats.voiceCalls}
            valueColor="text-blue-600"
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            iconBg="bg-emerald-100"
            label="Leads captured"
            value={stats.leads}
            valueColor="text-emerald-600"
          />
        </div>

      </div>
    </div>
  );
}
