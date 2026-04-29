import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { LayoutDashboard, BarChart3, User, MessageSquare, Plus, Phone, Menu, X, Code2, Calendar } from "lucide-react";
import { AgentFactoryLogo } from "@/components/AgentFactoryLogo";
import { OwnerChatWidget } from "@/components/dashboard/OwnerChatWidget";
import { ChatWidgetPage } from "./dashboard.chat-widget";

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
  { to: "/dashboard/phone-numbers", label: "Phone Numbers", icon: Phone },
  { to: "/dashboard/chat-widget", label: "Chat Widget", icon: Code2 },
  { to: "/dashboard/new-agent", label: "New Agent", icon: Plus },
] as const;

function DashboardLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const isActive = (to: string, exact?: boolean) =>
    exact ? location.pathname === to : location.pathname.startsWith(to);

  const NavLinks = () => (
    <>
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
    </>
  );

  return (
    <div className="flex min-h-screen bg-[oklch(0.97_0.012_85)]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-6 py-6">
          <AgentFactoryLogo />
        </div>
        <nav className="flex-1 px-3 py-6 space-y-1">
          <NavLinks />
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

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 h-14">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="p-2 -ml-2 rounded-md hover:bg-muted"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>
        <AgentFactoryLogo />
        <div className="w-9" />
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85%] flex flex-col bg-card border-r border-border animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <AgentFactoryLogo />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="p-2 -mr-2 rounded-md hover:bg-muted"
              >
                <X className="h-5 w-5 text-foreground" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
              <NavLinks />
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
        </>
      )}

      {/* Main */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        {location.pathname === "/dashboard/chat-widget" ? (
          <ChatWidgetPage />
        ) : (
          <Outlet />
        )}
      </main>

      {/* Floating help chat */}
      <OwnerChatWidget />
    </div>
  );
}
