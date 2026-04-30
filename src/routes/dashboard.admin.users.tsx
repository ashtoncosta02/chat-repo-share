import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { getAdminUsers } from "@/server/admin.functions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Shield, Search } from "lucide-react";

export const Route = createFileRoute("/dashboard/admin/users")({
  head: () => ({ meta: [{ title: "Admin · Users — Agent Factory" }] }),
  component: AdminUsersPage,
});

type AdminUser = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  is_admin: boolean;
  agent: { business_name: string; is_live: boolean; onboarding_completed: boolean } | null;
  widget_conversations: number;
  voice_conversations: number;
  bookings: number;
  leads: number;
};

function AdminUsersPage() {
  const { session } = useAuth();
  const { isAdmin, checked } = useIsAdmin();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (checked && !isAdmin) navigate({ to: "/dashboard" });
  }, [checked, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin || !session?.access_token) return;
    setLoading(true);
    getAdminUsers({ data: { accessToken: session.access_token } })
      .then((res) => {
        if ("users" in res) setUsers(res.users as AdminUser[]);
      })
      .finally(() => setLoading(false));
  }, [isAdmin, session?.access_token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.display_name ?? "").toLowerCase().includes(q) ||
        (u.agent?.business_name ?? "").toLowerCase().includes(q),
    );
  }, [users, search]);

  if (!checked || !isAdmin) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="All users"
        description={`${users.length} total accounts`}
        breadcrumb={
          <Link to="/dashboard/admin" className="inline-flex items-center gap-1.5 hover:text-foreground">
            <Shield className="h-3.5 w-3.5" /> Admin
          </Link>
        }
      />

      <div className="p-4 md:p-8 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, name, or business"
            className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
          />
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Receptionist</th>
                  <th className="text-right px-4 py-3 font-medium">Chats</th>
                  <th className="text-right px-4 py-3 font-medium">Calls</th>
                  <th className="text-right px-4 py-3 font-medium">Bookings</th>
                  <th className="text-right px-4 py-3 font-medium">Leads</th>
                  <th className="text-right px-4 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No users found.</td>
                  </tr>
                ) : (
                  filtered.map((u) => (
                    <tr key={u.user_id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground flex items-center gap-2">
                          {u.display_name || u.email?.split("@")[0]}
                          {u.is_admin && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.96_0.04_75)] px-2 py-0.5 text-[10px] font-medium text-[var(--gold-foreground)]">
                              <Shield className="h-3 w-3" /> Admin
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        {u.agent ? (
                          <div>
                            <div className="text-foreground">{u.agent.business_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {u.agent.is_live ? (
                                <span className="text-green-700">● Live</span>
                              ) : (
                                <span>○ Draft</span>
                              )}
                              {!u.agent.onboarding_completed && " · onboarding incomplete"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{u.widget_conversations}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{u.voice_conversations}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{u.bookings}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{u.leads}</td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
