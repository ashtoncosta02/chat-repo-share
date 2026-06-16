import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { getAdminTicketDetail, adminUpdateTicket, adminReplyTicket } from "@/lib/admin.functions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/admin/tickets/$ticketId")({
  head: () => ({ meta: [{ title: "Admin · Ticket" }] }),
  component: AdminTicketDetail,
});

function AdminTicketDetail() {
  const { ticketId } = Route.useParams();
  const { session } = useAuth();
  const { isAdmin, checked } = useIsAdmin();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (checked && !isAdmin) navigate({ to: "/dashboard" });
  }, [checked, isAdmin, navigate]);

  const load = () => {
    if (!session?.access_token) return;
    setLoading(true);
    getAdminTicketDetail({ data: { accessToken: session.access_token, ticketId } })
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAdmin && session?.access_token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, session?.access_token, ticketId]);

  if (!checked || !isAdmin) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (loading || !data) return <div className="p-8 text-muted-foreground">Loading ticket…</div>;
  if (!data.success) return <div className="p-8 text-muted-foreground">Ticket not found.</div>;

  const { ticket, messages, customer } = data;

  const updateField = async (patch: { status?: string; priority?: string }) => {
    if (!session?.access_token) return;
    const r = await adminUpdateTicket({ data: { accessToken: session.access_token, ticketId, ...patch } as any });
    if (r.success) {
      toast.success("Updated");
      load();
    } else toast.error(r.error ?? "Failed");
  };

  const send = async () => {
    if (!reply.trim() || !session?.access_token) return;
    setSending(true);
    try {
      const r = await adminReplyTicket({ data: { accessToken: session.access_token, ticketId, body: reply } });
      if (r.success) {
        setReply("");
        load();
      } else toast.error(r.error ?? "Failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-full">
      <PageHeader
        title={ticket.subject}
        description={`From ${customer?.display_name || customer?.email || "Unknown"} · opened ${new Date(ticket.created_at).toLocaleString()}`}
        breadcrumb={
          <Link to="/dashboard/admin/tickets" className="inline-flex items-center gap-1.5 hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> All tickets
          </Link>
        }
      />
      <div className="p-4 md:p-8 max-w-4xl space-y-6">
        {/* Controls */}
        <div className="rounded-xl border border-border bg-card p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <select
              value={ticket.status}
              onChange={(e) => updateField({ status: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="waiting">Waiting on customer</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Priority</label>
            <select
              value={ticket.priority}
              onChange={(e) => updateField({ priority: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Customer</label>
            <Link
              to="/dashboard/admin/users/$userId"
              params={{ userId: ticket.user_id }}
              className="mt-1 block text-sm text-[var(--gold)] hover:underline truncate"
            >
              {customer?.email ?? "View account →"}
            </Link>
          </div>
        </div>

        {/* Original */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground mb-2">Original report</div>
          <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.description}</p>
        </div>

        {/* Thread */}
        <div className="space-y-3">
          {messages.map((m: any) => (
            <div
              key={m.id}
              className={`rounded-xl border p-4 ${m.sender_role === "admin" ? "bg-[oklch(0.96_0.04_290)] border-border ml-8" : "bg-card border-border mr-8"}`}
            >
              <div className="text-xs text-muted-foreground mb-1">
                {m.sender_role === "admin" ? "You (support)" : "Customer"} · {new Date(m.created_at).toLocaleString()}
              </div>
              <p className="text-sm whitespace-pre-wrap">{m.body}</p>
            </div>
          ))}
        </div>

        {/* Reply */}
        <div className="rounded-xl border border-border bg-card p-4">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
            placeholder="Reply to customer…"
            className="w-full text-sm bg-transparent focus:outline-none resize-none"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={send}
              disabled={sending || !reply.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> Send reply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
