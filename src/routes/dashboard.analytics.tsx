import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

export const Route = createFileRoute("/dashboard/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Agent Factory" }] }),
  component: AnalyticsPage,
});

interface ConvRow {
  started_at: string;
  message_count: number;
}

function AnalyticsPage() {
  const { user } = useAuth();
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("conversations")
      .select("started_at, message_count")
      .order("started_at", { ascending: false })
      .then(({ data }) => {
        setConvs(data ?? []);
        setLoading(false);
      });
  }, [user]);

  // Hour-of-day distribution (0-23)
  const hourly = useMemo(() => {
    const buckets: Record<number, number> = {};
    for (let h = 0; h < 24; h++) buckets[h] = 0;
    convs.forEach((c) => {
      const h = new Date(c.started_at).getHours();
      buckets[h] += 1;
    });
    return Object.entries(buckets).map(([h, count]) => ({
      hour: `${h.padStart(2, "0")}:00`,
      hourNum: parseInt(h),
      calls: count,
    }));
  }, [convs]);

  // Daily call volume — last 14 days
  const daily = useMemo(() => {
    const buckets: Record<string, number> = {};
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }
    convs.forEach((c) => {
      const key = new Date(c.started_at).toISOString().slice(0, 10);
      if (key in buckets) buckets[key] += 1;
    });
    return Object.entries(buckets).map(([date, calls]) => ({
      date: new Date(date).toLocaleDateString("en", { month: "short", day: "numeric" }),
      calls,
    }));
  }, [convs]);

  const totalConversations = convs.length;
  const callVolume = convs.length;
  const peakHour = useMemo(() => {
    if (!convs.length) return "—";
    const top = [...hourly].sort((a, b) => b.calls - a.calls)[0];
    if (top.calls === 0) return "—";
    const h = top.hourNum;
    const ampm = h >= 12 ? "PM" : "AM";
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display}:00 ${ampm}`;
  }, [convs, hourly]);

  const peakHourIdx = useMemo(() => {
    let max = -1;
    let idx = -1;
    hourly.forEach((b, i) => {
      if (b.calls > max) {
        max = b.calls;
        idx = i;
      }
    });
    return max > 0 ? idx : -1;
  }, [hourly]);

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Call volume, peak hours, and conversation insights"
      />
      <div className="p-4 md:p-8 space-y-4 md:space-y-6">
        {loading ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
            Loading analytics…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <MetricCard label="Call Volume" value={callVolume} color="text-[var(--gold)]" />
              <MetricCard label="Total Conversations" value={totalConversations} color="text-emerald-600" />
              <MetricCard label="Peak Hour" value={peakHour} color="text-blue-600" />
            </div>

            <ChartCard
              title="Call Volume — Last 14 Days"
              description="Number of conversations per day"
            >
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={daily} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
                  <Bar dataKey="calls" fill="var(--gold)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Hour-of-day chart hidden on mobile to keep page readable */}
            <div className="hidden md:block">
              <ChartCard
                title="Calls by Hour of Day"
                description="When your customers are most likely to call"
              >
                <ResponsiveContainer width="100%" height={280}>
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
                    <Bar dataKey="calls" radius={[6, 6, 0, 0]}>
                      {hourly.map((_, i) => (
                        <Cell key={i} fill={i === peakHourIdx ? "oklch(0.6 0.18 30)" : "var(--gold)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Cumulative chart desktop-only */}
            <div className="hidden md:block">
              <ChartCard
                title="Total Conversations Over Time"
                description="Cumulative growth across the last 14 days"
              >
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={daily.reduce<{ date: string; total: number }[]>((acc, d, i) => {
                      const prev = i === 0 ? 0 : acc[i - 1].total;
                      acc.push({ date: d.date, total: prev + d.calls });
                      return acc;
                    }, [])}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.5rem",
                      }}
                    />
                    <Bar dataKey="total" fill="oklch(0.6 0.15 160)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
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
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="text-sm font-medium text-muted-foreground mb-2">{label}</div>
      <div className={`font-display text-4xl font-semibold ${color}`}>{value}</div>
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
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
