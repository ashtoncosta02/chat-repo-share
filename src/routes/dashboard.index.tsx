import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/dashboard/PageHeader";
import { Calendar, CheckCircle2, MessageSquare, Phone, ChevronRight } from "lucide-react";
import { AnalyticsPage } from "./dashboard.analytics";
import { VOICE_OPTIONS, DEFAULT_VOICE_ID } from "@/lib/voices";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({ meta: [{ title: "Dashboard — Ask Janice" }] }),
  component: DashboardHome,
});

interface AgentRow {
  id: string;
  business_name: string;
  assistant_name: string | null;
  industry: string | null;
  is_live: boolean;
  voice_id: string | null;
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
        .select("id, business_name, assistant_name, industry, is_live, voice_id, created_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;

      if (!agentRow) {
        navigate({ to: "/dashboard/onboarding" });
        return;
      }
      setAgent(agentRow as AgentRow);

      const [chats, leads, calls, cal, outlook] = await Promise.all([
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
        supabase
          .from("agent_outlook_calendar")
          .select("id", { head: true, count: "exact" })
          .eq("agent_id", agentRow.id),
      ]);

      if (cancelled) return;
      setStats({
        conversations: chats.count ?? 0,
        leads: leads.count ?? 0,
        voiceCalls: calls.count ?? 0,
      });
      setCalendarConnected((cal.count ?? 0) + (outlook.count ?? 0) > 0);
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

  const assistantName = agent.assistant_name?.trim() || "Janice";
  const voice =
    VOICE_OPTIONS.find((v) => v.id === (agent.voice_id ?? DEFAULT_VOICE_ID)) ??
    VOICE_OPTIONS[0];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`${assistantName} is ${agent.is_live ? "live" : "offline"} for ${agent.business_name}`}
      />
      <div className="p-4 md:p-8 space-y-4 md:space-y-6">
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

        <Link
          to="/dashboard/agents/$agentId"
          params={{ agentId: agent.id }}
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/50 transition max-w-md"
        >
          <img
            src={voice.avatar}
            alt={assistantName}
            className="h-10 w-10 rounded-full object-cover shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground truncate text-sm">
              {assistantName}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              Your AI Receptionist
            </div>
          </div>
          <span
            className={`hidden sm:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              calendarConnected
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            <Calendar className="h-2.5 w-2.5" />
            {calendarConnected ? "Cal on" : "Cal off"}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              agent.is_live
                ? "bg-emerald-100 text-emerald-700"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {agent.is_live ? "Live" : "Draft"}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </Link>
      </div>


      <AnalyticsPage />
    </div>
  );
}
