import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

export const Route = createFileRoute("/dashboard/analytics")({
  head: () => ({ meta: [{ title: "Analytics — AI Receptionist" }] }),
  component: AnalyticsPage,
});

interface AgentOpt {
  id: string;
  business_name: string;
}
interface ConvRow {
  started_at: string;
  agent_id: string | null;
}
interface WidgetConvRow {
  created_at: string;
  agent_id: string;
}
interface LeadRow {
  created_at: string;
  agent_id: string | null;
  status: string;
}
interface BookingRow {
  created_at: string;
  agent_id: string;
}

type RangeKey = "7" | "14" | "30" | "90";
const RANGE_LABEL: Record<RangeKey, string> = {
  "7": "Last 7 days",
  "14": "Last 14 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
};

function AnalyticsPage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AgentOpt[]>([]);
  const [voice, setVoice] = useState<ConvRow[]>([]);
  const [chats, setChats] = useState<WidgetConvRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [range, setRange] = useState<RangeKey>("14");

  useEffect(() => {
    if (!user) return;
    const since = new Date();
    since.setDate(since.getDate() - 90); // pull 90 days; we slice client-side
    const sinceIso = since.toISOString();
    setLoading(true);
    Promise.all([
      supabase.from("agents").select("id, business_name").order("business_name"),
      supabase
        .from("conversations")
        .select("started_at, agent_id")
        .gte("started_at", sinceIso),
      supabase
        .from("widget_conversations")
        .select("created_at, agent_id")
        .gte("created_at", sinceIso),
      supabase
        .from("leads")
        .select("created_at, agent_id, status")
        .gte("created_at", sinceIso),
      supabase
        .from("calendar_bookings")
        .select("created_at, agent_id")
        .gte("created_at", sinceIso),
    ]).then(([a, v, w, l, b]) => {
      setAgents(a.data ?? []);
      setVoice(v.data ?? []);
      setChats(w.data ?? []);
      setLeads(l.data ?? []);
      setBookings(b.data ?? []);
      setLoading(false);
    });
  }, [user]);

  const days = parseInt(range);
  const cutoff = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1));
    return d;
  }, [days]);

  const inRange = (iso: string) => new Date(iso) >= cutoff;
  const matchAgent = (id: string | null) =>
    agentFilter === "all" || id === agentFilter;

  const fVoice = voice.filter((r) => inRange(r.started_at) && matchAgent(r.agent_id));
  const fChats = chats.filter((r) => inRange(r.created_at) && matchAgent(r.agent_id));
  const fLeads = leads.filter((r) => inRange(r.created_at) && matchAgent(r.agent_id));
  const fBookings = bookings.filter(
    (r) => inRange(r.created_at) && matchAgent(r.agent_id),
  );

  const totalConvs = fVoice.length + fChats.length;
  const totalLeads = fLeads.length;
  const totalBookings = fBookings.length;
  const conversionRate =
    totalConvs > 0 ? Math.round((totalLeads / totalConvs) * 100) : 0;

  // Daily trend
  const trend = useMemo(() => {
    const buckets: Record<
      string,
      { date: string; chats: number; voice: number; leads: number; bookings: number }
    > = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = {
        date: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
        chats: 0,
        voice: 0,
        leads: 0,
        bookings: 0,
      };
    }
    const bump = (iso: string, field: "chats" | "voice" | "leads" | "bookings") => {
      const key = new Date(iso).toISOString().slice(0, 10);
      if (buckets[key]) buckets[key][field] += 1;
    };
    fVoice.forEach((r) => bump(r.started_at, "voice"));
    fChats.forEach((r) => bump(r.created_at, "chats"));
    fLeads.forEach((r) => bump(r.created_at, "leads"));
    fBookings.forEach((r) => bump(r.created_at, "bookings"));
    return Object.values(buckets);
  }, [fVoice, fChats, fLeads, fBookings, days]);

  // Per-agent leaderboard
  const leaderboard = useMemo(() => {
    const map = new Map<
      string,
      { name: string; convs: number; leads: number; bookings: number }
    >();
    const ensure = (id: string | null) => {
      const key = id ?? "unknown";
      if (!map.has(key)) {
        const name = id
          ? agents.find((a) => a.id === id)?.business_name ?? "Unknown agent"
          : "Unassigned";
        map.set(key, { name, convs: 0, leads: 0, bookings: 0 });
      }
      return map.get(key)!;
    };
    fVoice.forEach((r) => ensure(r.agent_id).convs++);
    fChats.forEach((r) => ensure(r.agent_id).convs++);
    fLeads.forEach((r) => ensure(r.agent_id).leads++);
    fBookings.forEach((r) => ensure(r.agent_id).bookings++);
    return Array.from(map.values())
      .map((row) => ({
        ...row,
        conversion: row.convs > 0 ? Math.round((row.leads / row.convs) * 100) : 0,
      }))
      .sort((a, b) => b.convs - a.convs);
  }, [fVoice, fChats, fLeads, fBookings, agents]);

  // Hour-of-day across both voice + chat
  const hourly = useMemo(() => {
    const buckets: Record<number, number> = {};
    for (let h = 0; h < 24; h++) buckets[h] = 0;
    fVoice.forEach((c) => (buckets[new Date(c.started_at).getHours()] += 1));
    fChats.forEach((c) => (buckets[new Date(c.created_at).getHours()] += 1));
    return Object.entries(buckets).map(([h, count]) => ({
      hour: `${h.padStart(2, "0")}:00`,
      hourNum: parseInt(h),
      convs: count,
    }));
  }, [fVoice, fChats]);

  const peakHourIdx = useMemo(() => {
    let max = 0;
    let idx = -1;
    hourly.forEach((b, i) => {
      if (b.convs > max) {
        max = b.convs;
        idx = i;
      }
    });
    return idx;
  }, [hourly]);

  const peakHour = useMemo(() => {
    if (peakHourIdx < 0) return "—";
    const h = hourly[peakHourIdx].hourNum;
    const ampm = h >= 12 ? "PM" : "AM";
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display}:00 ${ampm}`;
  }, [hourly, peakHourIdx]);

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Conversations, leads, bookings, and conversion for your AI receptionist"
      />
      <div className="p-4 md:p-8 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row gap-2">
          {agents.length > 1 && (
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="sm:w-64">
                <SelectValue placeholder="All receptionists" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All receptionists</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.business_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RANGE_LABEL) as RangeKey[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {RANGE_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
            Loading analytics…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
              <MetricCard label="Conversations" value={totalConvs} color="text-[var(--gold)]" />
              <MetricCard label="Chat" value={fChats.length} />
              <MetricCard label="Voice" value={fVoice.length} />
              <MetricCard label="Leads Captured" value={totalLeads} color="text-emerald-600" />
              <MetricCard
                label="Bookings"
                value={totalBookings}
                color="text-blue-600"
                sub={`${conversionRate}% conv. rate`}
              />
            </div>

            <ChartCard
              title={`Daily Activity — ${RANGE_LABEL[range]}`}
              description="Conversations, leads, and bookings per day"
            >
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="chats" stroke="var(--gold)" strokeWidth={2} dot={false} name="Chat" />
                  <Line type="monotone" dataKey="voice" stroke="oklch(0.6 0.18 30)" strokeWidth={2} dot={false} name="Voice" />
                  <Line type="monotone" dataKey="leads" stroke="oklch(0.6 0.15 160)" strokeWidth={2} dot={false} name="Leads" />
                  <Line type="monotone" dataKey="bookings" stroke="oklch(0.55 0.18 250)" strokeWidth={2} dot={false} name="Bookings" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {agents.length > 1 && (
              <ChartCard
                title="Per-Receptionist Performance"
                description="Ranked by total conversations in this range"
              >
                {leaderboard.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    No activity in this range yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="py-2 pr-4 font-medium">Receptionist</th>
                          <th className="py-2 px-4 font-medium text-right">Conversations</th>
                          <th className="py-2 px-4 font-medium text-right">Leads</th>
                          <th className="py-2 px-4 font-medium text-right">Bookings</th>
                          <th className="py-2 pl-4 font-medium text-right">Conversion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((row, i) => (
                          <tr key={i} className="border-b border-border/50 last:border-0">
                            <td className="py-3 pr-4 font-medium text-foreground truncate max-w-[200px]">
                              {row.name}
                            </td>
                            <td className="py-3 px-4 text-right">{row.convs}</td>
                            <td className="py-3 px-4 text-right text-emerald-600">{row.leads}</td>
                            <td className="py-3 px-4 text-right text-blue-600">{row.bookings}</td>
                            <td className="py-3 pl-4 text-right text-muted-foreground">
                              {row.conversion}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </ChartCard>
            )}

            <div className="hidden md:block">
              <ChartCard
                title="Conversations by Hour of Day"
                description="When customers are most likely to engage"
              >
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={hourly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={11} interval={1} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.5rem",
                      }}
                    />
                    <Bar dataKey="convs" radius={[6, 6, 0, 0]}>
                      {hourly.map((_, i) => (
                        <Cell key={i} fill={i === peakHourIdx ? "oklch(0.6 0.18 30)" : "var(--gold)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-xs text-muted-foreground mt-2">
                  Peak hour: <span className="font-medium text-foreground">{peakHour}</span>
                </p>
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-6">
      <div className="text-xs md:text-sm font-medium text-muted-foreground mb-2">{label}</div>
      <div className={`font-display text-2xl md:text-4xl font-semibold ${color ?? "text-foreground"}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-6">
      <div className="mb-4">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
