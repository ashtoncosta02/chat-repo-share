import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { getAdminOverview, adminResyncAllReceptionists } from "@/lib/admin.functions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Users, Bot, MessageSquare, Phone, Calendar, User as UserIcon, Shield, DollarSign, AlertCircle, TrendingUp, Clock, LifeBuoy } from "lucide-react";

export const Route = createFileRoute("/dashboard/admin/")({
  head: () => ({ meta: [{ title: "Admin — Ask Janice" }] }),
  component: AdminOverviewPage,
});

type Overview = Awaited<ReturnType<typeof getAdminOverview>>;

function AdminOverviewPage() {
  const { session } = useAuth();
  const { isAdmin, checked } = useIsAdmin();
  const navigate = useNavigate();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (checked && !isAdmin) navigate({ to: "/dashboard" });
  }, [checked, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin || !session?.access_token) return;
    setLoading(true);
    getAdminOverview({ data: { accessToken: session.access_token } })
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, [isAdmin, session?.access_token]);

  if (!checked || !isAdmin) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }

  const stats = data && "stats" in data ? data.stats : null;
  const recentSignups = (data && "recentSignups" in data ? data.recentSignups : []) ?? [];

  const fmtSecs = (s: number) => {
    if (!s) return "—";
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}m ${r}s` : `${r}s`;
  };
  const deltaLabel = (pct: number) => {
    const sign = pct > 0 ? "▲" : pct < 0 ? "▼" : "—";
    return `${sign} ${Math.abs(pct)}% vs prev 7d`;
  };

  return (
    <div className="min-h-full">
      <PageHeader
        title="Owner Dashboard"
        description="Business health, growth, product activity, and support load across all accounts."
        breadcrumb={
          <span className="inline-flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Admin
          </span>
        }
        action={
          <div className="flex gap-2 flex-wrap">
            <ResyncAllButton accessToken={session?.access_token} />
            <Link to="/dashboard/admin/tickets" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted">Tickets</Link>
            <Link to="/dashboard/admin/health" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted">System health</Link>
            <Link to="/dashboard/admin/users" className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90">All users</Link>
          </div>
        }
      />

      <div className="p-4 md:p-8 space-y-8">
        {loading || !stats ? (
          <div className="text-muted-foreground">Loading stats…</div>
        ) : (
          <>
            {/* Revenue row — placeholders until Stripe is wired */}
            <section>
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><DollarSign className="h-3.5 w-3.5" /> Revenue & growth</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <PlaceholderCard label="MRR" value="—" hint="Connect Stripe" />
                <PlaceholderCard label="ARR" value="—" hint="Connect Stripe" />
                <MetricCard
                  icon={<TrendingUp className="h-5 w-5 text-[var(--gold)]" />}
                  iconBg="bg-[oklch(0.96_0.04_290)]"
                  label="Signups (7d)"
                  value={stats.users.new7d}
                  sublabel={deltaLabel(stats.users.deltaPct)}
                />
                <MetricCard
                  icon={<Users className="h-5 w-5 text-[var(--gold)]" />}
                  iconBg="bg-[oklch(0.96_0.04_290)]"
                  label="Activation"
                  value={`${stats.users.activationPct}%`}
                  sublabel="Completed onboarding"
                />
              </div>
            </section>

            {/* Today / This week */}
            <section>
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> Activity</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard icon={<Phone className="h-5 w-5 text-[var(--gold)]" />} iconBg="bg-[oklch(0.96_0.04_290)]" label="Calls today" value={stats.voiceConversations.today} sublabel={`${stats.voiceConversations.last7d} in 7d`} />
                <MetricCard icon={<MessageSquare className="h-5 w-5 text-[var(--gold)]" />} iconBg="bg-[oklch(0.96_0.04_290)]" label="Chats today" value={stats.widgetConversations.today} sublabel={`${stats.widgetConversations.last7d} in 7d`} />
                <MetricCard icon={<Calendar className="h-5 w-5 text-[var(--gold)]" />} iconBg="bg-[oklch(0.96_0.04_290)]" label="Bookings (7d)" value={stats.bookings.last7d} sublabel={`${stats.bookings.upcoming} upcoming`} />
                <MetricCard icon={<AlertCircle className="h-5 w-5 text-red-600" />} iconBg="bg-red-50" label="Failed calls (24h)" value={stats.voiceConversations.failed24h} sublabel={stats.voiceConversations.failed24h > 0 ? "Investigate" : "All good"} />
              </div>
            </section>

            {/* Product health */}
            <section>
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><Bot className="h-3.5 w-3.5" /> Product health</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard icon={<Users className="h-5 w-5 text-[var(--gold)]" />} iconBg="bg-[oklch(0.96_0.04_290)]" label="Active accounts (7d)" value={stats.agents.active7d} sublabel={`${stats.users.total} total`} />
                <MetricCard icon={<Bot className="h-5 w-5 text-[var(--gold)]" />} iconBg="bg-[oklch(0.96_0.04_290)]" label="Receptionists live" value={`${stats.agents.live} / ${stats.agents.total}`} />
                <MetricCard icon={<Phone className="h-5 w-5 text-[var(--gold)]" />} iconBg="bg-[oklch(0.96_0.04_290)]" label="Avg call length" value={fmtSecs(stats.voiceConversations.avgCallSecs)} sublabel="Last 7 days" />
                <MetricCard icon={<Calendar className="h-5 w-5 text-[var(--gold)]" />} iconBg="bg-[oklch(0.96_0.04_290)]" label="Calendars connected" value={stats.calendarsConnected} />
              </div>
            </section>

            {/* Support + Infra */}
            <section>
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><LifeBuoy className="h-3.5 w-3.5" /> Support & costs</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link to="/dashboard/admin/tickets" className="block">
                  <MetricCard icon={<LifeBuoy className="h-5 w-5 text-[var(--gold)]" />} iconBg="bg-[oklch(0.96_0.04_290)]" label="Open tickets" value={stats.tickets.open} sublabel={`${stats.tickets.closed7d} closed in 7d`} />
                </Link>
                <MetricCard icon={<Clock className="h-5 w-5 text-[var(--gold)]" />} iconBg="bg-[oklch(0.96_0.04_290)]" label="Oldest open ticket" value={stats.tickets.oldestOpenAgeHours == null ? "—" : `${stats.tickets.oldestOpenAgeHours}h`} sublabel="Age" />
                <MetricCard icon={<Phone className="h-5 w-5 text-[var(--gold)]" />} iconBg="bg-[oklch(0.96_0.04_290)]" label="Voice minutes (mo)" value={stats.voiceConversations.voiceMinutesMonth} sublabel="ElevenLabs usage" />
                <MetricCard icon={<Phone className="h-5 w-5 text-[var(--gold)]" />} iconBg="bg-[oklch(0.96_0.04_290)]" label="Numbers (mo)" value={stats.phoneNumbersThisMonth} sublabel={`${stats.phoneNumbers} total`} />
              </div>
            </section>

            {/* Recent signups */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-foreground">Recent signups</h2>
                <Link to="/dashboard/admin/users" className="text-sm text-[var(--gold)] hover:underline">View all →</Link>
              </div>
              <div className="divide-y divide-border">
                {recentSignups.length === 0 ? (
                  <div className="px-6 py-8 text-sm text-muted-foreground text-center">No users yet.</div>
                ) : (
                  recentSignups.map((u) => (
                    <Link key={u.user_id} to="/dashboard/admin/users/$userId" params={{ userId: u.user_id }} className="px-6 py-3 flex items-center justify-between gap-4 hover:bg-muted/50">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{u.display_name || u.email}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PlaceholderCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-6">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="font-display text-3xl font-semibold mt-2 text-muted-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}

function MetricCard({ icon, iconBg, label, value, sublabel }: { icon: React.ReactNode; iconBg: string; label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-lg p-2 ${iconBg}`}>{icon}</div>
      </div>
      <div className="mt-3 text-sm text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-semibold mt-1">{value}</div>
      {sublabel && <div className="text-xs text-muted-foreground mt-1">{sublabel}</div>}
    </div>
  );
}
