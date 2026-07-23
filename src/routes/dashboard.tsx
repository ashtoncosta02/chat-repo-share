import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, BarChart3, User, MessageSquare, Menu, X, Code2, Calendar, Shield, Bot, Phone, Bell, LifeBuoy, BookOpen } from "lucide-react";
import { AgentFactoryLogo } from "@/components/AgentFactoryLogo";
import { OwnerChatWidget } from "@/components/dashboard/OwnerChatWidget";
import { DialerPanel } from "@/components/dashboard/DialerPanel";
import { CalendarHealthBanner } from "@/components/dashboard/CalendarHealthBanner";
import { AccountMenu } from "@/components/dashboard/AccountMenu";
import { ImpersonationBanner } from "@/components/dashboard/ImpersonationBanner";
import { ChatWidgetPage } from "./dashboard.chat-widget";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Ask Janice" },
      { name: "description", content: "Manage your AI Receptionist." },
    ],
  }),
  component: DashboardLayout,
});

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/agent", label: "Agent", icon: Bot },
  { to: "/dashboard/knowledge", label: "Knowledge", icon: BookOpen },
  { to: "/dashboard/conversations", label: "Threads", icon: MessageSquare },
  { to: "/dashboard/bookings", label: "Bookings", icon: Calendar },
  { to: "/dashboard/chat-widget", label: "Chat Widget", icon: Code2 },
  { to: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { to: "/dashboard/help", label: "Help", icon: LifeBuoy },
] as const;

const adminNavItem = { to: "/dashboard/admin", label: "Admin", icon: Shield } as const;

function DashboardLayout() {
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  // First-time hint pointing new users at the Knowledge nav item.
  // Dismissed permanently the first time they click it (or the bubble).
  const knowledgeHintKey = user ? `janice.knowledge-hint-dismissed.${user.id}` : null;
  const [showKnowledgeHint, setShowKnowledgeHint] = useState(false);
  useEffect(() => {
    if (!knowledgeHintKey) return;
    if (typeof window === "undefined") return;
    setShowKnowledgeHint(window.localStorage.getItem(knowledgeHintKey) !== "1");
  }, [knowledgeHintKey]);
  const dismissKnowledgeHint = () => {
    setShowKnowledgeHint(false);
    if (knowledgeHintKey && typeof window !== "undefined") {
      window.localStorage.setItem(knowledgeHintKey, "1");
    }
  };
  const [dialerOpen, setDialerOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // Gate: if a signed-in user has no completed receptionist, send them to onboarding.
  // The onboarding route itself is excluded so the wizard can render.
  useEffect(() => {
    if (loading || !user) return;
    if (location.pathname === "/dashboard/onboarding" || location.pathname.startsWith("/dashboard/admin")) {
      setOnboardingChecked(true);
      return;
    }
    let cancelled = false;
    supabase
      .from("agents")
      .select("id, onboarding_completed")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (!data || !data.onboarding_completed) {
          navigate({ to: "/dashboard/onboarding" });
        } else {
          setAgentId(data.id);
          setOnboardingChecked(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading, location.pathname, navigate]);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Show loading until both auth + onboarding gate have resolved.
  // The onboarding wizard at /dashboard/onboarding renders inside this layout
  // but does NOT need the gate to pass first.
  const isOnboardingRoute = location.pathname === "/dashboard/onboarding";
  const isAdminRoute = location.pathname.startsWith("/dashboard/admin");
  if (loading || !user || (!isOnboardingRoute && !isAdminRoute && !onboardingChecked)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const isActive = (to: string, exact?: boolean) =>
    exact ? location.pathname === to : location.pathname.startsWith(to);

  const NavLinks = () => {
    const items = isAdmin ? [...navItems, adminNavItem] : navItems;
    return (
      <>
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to, "exact" in item ? item.exact : false);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-[oklch(0.96_0.04_290)] text-[var(--gold-foreground)] font-medium"
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
  };

  return (
    <div className="flex min-h-screen bg-[oklch(0.97_0.012_290)]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-6 py-6">
          <AgentFactoryLogo />
        </div>
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          <NavLinks />
          <button
            onClick={() => setDialerOpen(true)}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              dialerOpen
                ? "bg-[oklch(0.96_0.04_290)] text-[var(--gold-foreground)] font-medium"
                : "text-foreground/80 hover:bg-muted"
            }`}
          >
            <Phone className="h-4 w-4" />
            Dialer
          </button>
        </nav>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 h-20">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="p-2 -ml-2 rounded-md hover:bg-muted"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>
        <AgentFactoryLogo imgClassName="h-20 w-auto object-contain" />
        <AccountMenu />
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
              <button
                onClick={() => {
                  setDialerOpen(true);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  dialerOpen
                    ? "bg-[oklch(0.96_0.04_290)] text-[var(--gold-foreground)] font-medium"
                    : "text-foreground/80 hover:bg-muted"
                }`}
              >
                <Phone className="h-4 w-4" />
                Dialer
              </button>
            </nav>
          </aside>
        </>
      )}

      {/* Dialer overlay */}
      {dialerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setDialerOpen(false)}
          />
          <div className="fixed z-50 left-0 md:left-64 top-0 bottom-0 w-full md:w-[380px] bg-card border-r border-border shadow-2xl animate-in slide-in-from-left duration-200 flex flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Dialer</span>
              <button
                onClick={() => setDialerOpen(false)}
                className="p-1.5 rounded-md hover:bg-muted"
                aria-label="Close dialer"
              >
                <X className="h-4 w-4 text-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <DialerPanel onClose={() => setDialerOpen(false)} />
            </div>
          </div>
        </>
      )}

      {/* Main */}
      <main className="flex-1 overflow-auto pt-20 md:pt-0">
        {/* Desktop top bar with account menu */}
        <div className="hidden md:flex items-center justify-end gap-3 border-b border-border bg-card/60 backdrop-blur px-6 h-14 sticky top-0 z-20">
          <AccountMenu />
        </div>
        <ImpersonationBanner currentEmail={user.email} />
        {agentId && <CalendarHealthBanner agentId={agentId} />}
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
