import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { getAdminOverview } from "@/server/admin.functions";
import { PageHeader, StatCard } from "@/components/dashboard/PageHeader";
import { Users, Bot, MessageSquare, Phone, Calendar, User as UserIcon, Shield } from "lucide-react";

export const Route = createFileRoute("/dashboard/admin")({
  head: () => ({ meta: [{ title: "Admin — Agent Factory" }] }),
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
  const recentSignups = data && "recentSignups" in data ? data.recentSignups : [];

  return (
    <div className="min-h-full">
      <PageHeader
        title="Admin Overview"
        description="App-wide stats across all accounts. Only visible to admins."
        breadcrumb={
          <span className="inline-flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Admin
          </span>
        }
        action={
          <Link
            to="/dashboard/admin/users"
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            View all users
          </Link>
        }
      />

      <div className="p-4 md:p-8 space-y-8">
        {loading || !stats ? (
          <div className="text-muted-foreground">Loading stats…</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={<Users className="h-5 w-5 text-[var(--gold)]" />}
                iconBg="bg-[oklch(0.96_0.04_75)]"
                label="Users"
                value={stats.users.total}
              />
              <StatCard
                icon={<Bot className="h-5 w-5 text-[var(--gold)]" />}
                iconBg="bg-[oklch(0.96_0.04_75)]"
                label="Receptionists live"
                value={`${stats.agents.live} / ${stats.agents.total}`}
              />
              <StatCard
                icon={<MessageSquare className="h-5 w-5 text-[var(--gold)]" />}
                iconBg="bg-[oklch(0.96_0.04_75)]"
                label="Chat conversations"
                value={stats.widgetConversations.total}
              />
              <StatCard
                icon={<Phone className="h-5 w-5 text-[var(--gold)]" />}
                iconBg="bg-[oklch(0.96_0.04_75)]"
                label="Voice calls"
                value={stats.voiceConversations.total}
              />
              <StatCard
                icon={<Calendar className="h-5 w-5 text-[var(--gold)]" />}
                iconBg="bg-[oklch(0.96_0.04_75)]"
                label="Bookings"
                value={stats.bookings.total}
              />
              <StatCard
                icon={<UserIcon className="h-5 w-5 text-[var(--gold)]" />}
                iconBg="bg-[oklch(0.96_0.04_75)]"
                label="Leads"
                value={stats.leads.total}
              />
              <StatCard
                icon={<Phone className="h-5 w-5 text-[var(--gold)]" />}
                iconBg="bg-[oklch(0.96_0.04_75)]"
                label="Phone numbers"
                value={stats.phoneNumbers}
              />
              <StatCard
                icon={<Calendar className="h-5 w-5 text-[var(--gold)]" />}
                iconBg="bg-[oklch(0.96_0.04_75)]"
                label="Calendars connected"
                value={stats.calendarsConnected}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="text-sm text-muted-foreground">New users (7d)</div>
                <div className="font-display text-3xl font-semibold mt-2">{stats.users.new7d}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="text-sm text-muted-foreground">New leads (7d)</div>
                <div className="font-display text-3xl font-semibold mt-2">{stats.leads.new7d}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="text-sm text-muted-foreground">Upcoming bookings</div>
                <div className="font-display text-3xl font-semibold mt-2">{stats.bookings.upcoming}</div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-foreground">Recent signups</h2>
                <Link to="/dashboard/admin/users" className="text-sm text-[var(--gold)] hover:underline">
                  View all →
                </Link>
              </div>
              <div className="divide-y divide-border">
                {recentSignups.length === 0 ? (
                  <div className="px-6 py-8 text-sm text-muted-foreground text-center">No users yet.</div>
                ) : (
                  recentSignups.map((u) => (
                    <div key={u.user_id} className="px-6 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {u.display_name || u.email}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(u.created_at).toLocaleDateString()}
                      </div>
                    </div>
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
