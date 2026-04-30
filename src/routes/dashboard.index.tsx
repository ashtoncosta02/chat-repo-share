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
            iconBg="bg-[oklch(0.95_0.05_75)]"
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

        {/* Single receptionist card */}
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 md:px-6 py-4">
            <h2 className="font-semibold text-foreground">Your AI Receptionist</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Click to edit, test, or manage settings.
            </p>
          </div>
          <Link
            to="/dashboard/agents/$agentId"
            params={{ agentId: agent.id }}
            className="flex items-center justify-between px-4 md:px-6 py-5 hover:bg-muted/50 transition gap-4"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-12 w-12 rounded-full bg-[oklch(0.95_0.05_75)] flex items-center justify-center shrink-0">
                <Bot className="h-6 w-6 text-[var(--gold)]" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-foreground truncate">
                  {assistantName}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {agent.business_name}
                  </span>
                </div>
                {agent.industry && (
                  <div className="text-sm text-muted-foreground truncate">{agent.industry}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`hidden sm:inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                  calendarConnected
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
                title={
                  calendarConnected
                    ? "Google Calendar connected — bookings enabled"
                    : "Connect Google Calendar to let your receptionist book appointments"
                }
              >
                <Calendar className="h-3 w-3" />
                {calendarConnected ? "Calendar on" : "Calendar off"}
              </span>
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  agent.is_live
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {agent.is_live ? "Live" : "Draft"}
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
