import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { LayoutDashboard, BarChart3, User, MessageSquare, Plus, Sparkles } from "lucide-react";
import { AgentFactoryLogo } from "@/components/AgentFactoryLogo";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Agent Factory" },
      { name: "description", content: "Manage your AI voice agents." },
    ],
  }),
  component: DashboardLayout,
});

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/leads", label: "Leads", icon: User },
  { to: "/dashboard/conversations", label: "Conversations", icon: MessageSquare },
  { to: "/dashboard/new-agent", label: "New Agent", icon: Plus },
] as const;

function DashboardLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const isActive = (to: string, exact?: boolean) =>
    exact ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <div className="flex min-h-screen bg-[oklch(0.97_0.012_85)]">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-6 py-6">
          <AgentFactoryLogo />
        </div>
        <nav className="flex-1 px-3 py-6 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, "exact" in item ? item.exact : false);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-[oklch(0.96_0.04_75)] text-[var(--gold-foreground)] font-medium"
                    : "text-foreground/80 hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border px-6 py-4">
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
            className="text-sm font-medium text-foreground hover:text-[var(--gold)] transition-colors"
          >
            My Account
          </button>
          <p className="mt-1 text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Floating action */}
      <Link
        to="/dashboard/new-agent"
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--gold)] text-white shadow-lg hover:scale-105 transition-transform"
        aria-label="New agent"
      >
        <Sparkles className="h-6 w-6" />
      </Link>
    </div>
  );
}
