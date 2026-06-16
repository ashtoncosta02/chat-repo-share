import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { getAdminTickets } from "@/lib/admin.functions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Shield, ArrowLeft, Ticket } from "lucide-react";

export const Route = createFileRoute("/dashboard/admin/tickets/")({
  head: () => ({ meta: [{ title: "Admin · Tickets" }] }),
  component: AdminTicketsKanban,
});

type T = {
  id: string;
  user_id: string;
  subject: string;
  status: "open" | "in_progress" | "waiting" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  category: string | null;
  created_at: string;
  user_email: string | null;
  user_name: string | null;
};

const COLUMNS: { key: T["status"]; label: string; color: string }[] = [
  { key: "open", label: "Open", color: "bg-red-50 border-red-200" },
  { key: "in_progress", label: "In progress", color: "bg-amber-50 border-amber-200" },
  { key: "waiting", label: "Waiting on customer", color: "bg-blue-50 border-blue-200" },
  { key: "resolved", label: "Resolved", color: "bg-green-50 border-green-200" },
  { key: "closed", label: "Closed", color: "bg-muted border-border" },
];

function AdminTicketsKanban() {
  const { session } = useAuth();
  const { isAdmin, checked } = useIsAdmin();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (checked && !isAdmin) navigate({ to: "/dashboard" });
  }, [checked, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin || !session?.access_token) return;
    setLoading(true);
    getAdminTickets({ data: { accessToken: session.access_token } })
      .then((r) => {
        if ("tickets" in r) setTickets(r.tickets as T[]);
      })
      .finally(() => setLoading(false));
  }, [isAdmin, session?.access_token]);

  const grouped = useMemo(() => {
    const g = new Map<T["status"], T[]>();
    COLUMNS.forEach((c) => g.set(c.key, []));
    tickets.forEach((t) => g.get(t.status)?.push(t));
    return g;
  }, [tickets]);

  if (!checked || !isAdmin) return <div className="p-8 text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-full">
      <PageHeader
        title="Support tickets"
        description={`${tickets.length} total — drag-free kanban (click a card to open)`}
        breadcrumb={
          <Link to="/dashboard/admin" className="inline-flex items-center gap-1.5 hover:text-foreground">
            <Shield className="h-3.5 w-3.5" /> Admin
          </Link>
        }
        action={
          <Link
            to="/dashboard/admin"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />
      <div className="p-4 md:p-6">
        {loading ? (
          <div className="text-muted-foreground">Loading tickets…</div>
        ) : tickets.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Ticket className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No tickets yet. Customer-submitted issues will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {COLUMNS.map((col) => {
              const list = grouped.get(col.key) ?? [];
              return (
                <div key={col.key} className={`rounded-xl border ${col.color} p-3`}>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                    <span className="text-xs text-muted-foreground tabular-nums">{list.length}</span>
                  </div>
                  <div className="space-y-2">
                    {list.map((t) => (
                      <Link
                        key={t.id}
                        to="/dashboard/admin/tickets/$ticketId"
                        params={{ ticketId: t.id }}
                        className="block rounded-lg bg-card border border-border p-3 text-sm hover:shadow-sm transition"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="font-medium text-foreground line-clamp-2">{t.subject}</div>
                          <PriorityDot p={t.priority} />
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {t.user_name || t.user_email || "Unknown"}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {new Date(t.created_at).toLocaleDateString()}
                        </div>
                      </Link>
                    ))}
                    {list.length === 0 && (
                      <div className="text-xs text-muted-foreground italic px-1 py-2">Empty</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PriorityDot({ p }: { p: T["priority"] }) {
  const map = {
    urgent: "bg-red-500",
    high: "bg-orange-500",
    normal: "bg-blue-400",
    low: "bg-gray-300",
  };
  return <span title={p} className={`h-2 w-2 rounded-full flex-shrink-0 mt-1.5 ${map[p]}`} />;
}
