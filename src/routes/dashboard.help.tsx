import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createTicket, getMyTickets, getMyTicketDetail, replyToTicket } from "@/lib/tickets.functions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { LifeBuoy, Plus, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/help")({
  head: () => ({ meta: [{ title: "Help & Support" }] }),
  component: HelpPage,
});

type Ticket = { id: string; subject: string; status: string; priority: string; created_at: string };

function HelpPage() {
  const list = useServerFn(getMyTickets);
  const create = useServerFn(createTicket);
  const detail = useServerFn(getMyTicketDetail);
  const reply = useServerFn(replyToTicket);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [view, setView] = useState<"list" | "new" | "detail">("list");
  const [openId, setOpenId] = useState<string | null>(null);
  const [openData, setOpenData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [submitting, setSubmitting] = useState(false);

  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await list();
      setTickets(r.tickets as Ticket[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (view === "detail" && openId) {
      detail({ data: { ticketId: openId } }).then(setOpenData);
    }
  }, [view, openId, detail]);

  const submit = async () => {
    if (!subject.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      await create({ data: { subject, description, priority } });
      toast.success("Ticket submitted! We'll get back to you soon.");
      setSubject(""); setDescription(""); setPriority("normal");
      setView("list");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !openId) return;
    setSending(true);
    try {
      await reply({ data: { ticketId: openId, body: replyText } });
      setReplyText("");
      const r = await detail({ data: { ticketId: openId } });
      setOpenData(r);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-full">
      <PageHeader
        title="Help & Support"
        description="Submit a ticket and we'll get back to you."
        breadcrumb={<span className="inline-flex items-center gap-1.5"><LifeBuoy className="h-3.5 w-3.5" /> Support</span>}
        action={
          view === "list" ? (
            <button
              onClick={() => setView("new")}
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> New ticket
            </button>
          ) : (
            <button
              onClick={() => { setView("list"); setOpenId(null); setOpenData(null); }}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          )
        }
      />
      <div className="p-4 md:p-8 max-w-3xl space-y-4">
        {view === "list" && (
          loading ? <div className="text-muted-foreground">Loading…</div> :
          tickets.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center">
              <LifeBuoy className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">No tickets yet. Need help with something?</p>
              <button onClick={() => setView("new")} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background">
                Submit your first ticket
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setOpenId(t.id); setView("detail"); }}
                  className="w-full text-left px-5 py-3 hover:bg-muted/40 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.subject}</div>
                    <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()} · {t.priority}</div>
                  </div>
                  <StatusBadge status={t.status} />
                </button>
              ))}
            </div>
          )
        )}

        {view === "new" && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <label className="text-sm font-medium">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Short summary"
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">What's happening?</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="Describe the issue in detail. Include what you tried and what you saw."
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">How urgent?</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="low">Low — minor question</option>
                <option value="normal">Normal — something's off</option>
                <option value="high">High — affecting customers</option>
                <option value="urgent">Urgent — receptionist down</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button
                onClick={submit}
                disabled={submitting || !subject.trim() || !description.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                Submit ticket
              </button>
            </div>
          </div>
        )}

        {view === "detail" && openData?.ticket && (
          <>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h2 className="font-semibold text-foreground">{openData.ticket.subject}</h2>
                <StatusBadge status={openData.ticket.status} />
              </div>
              <p className="text-sm whitespace-pre-wrap">{openData.ticket.description}</p>
              <div className="text-xs text-muted-foreground mt-2">{new Date(openData.ticket.created_at).toLocaleString()}</div>
            </div>
            <div className="space-y-3">
              {openData.messages.map((m: any) => (
                <div
                  key={m.id}
                  className={`rounded-xl border p-4 ${m.sender_role === "admin" ? "bg-[oklch(0.96_0.04_290)] mr-8" : "bg-card ml-8"}`}
                >
                  <div className="text-xs text-muted-foreground mb-1">
                    {m.sender_role === "admin" ? "Support" : "You"} · {new Date(m.created_at).toLocaleString()}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
            </div>
            {openData.ticket.status !== "closed" && (
              <div className="rounded-xl border border-border bg-card p-4">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={3}
                  placeholder="Add a reply…"
                  className="w-full text-sm bg-transparent focus:outline-none resize-none"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={sendReply}
                    disabled={sending || !replyText.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" /> Send
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-red-50 text-red-700",
    in_progress: "bg-amber-50 text-amber-700",
    waiting: "bg-blue-50 text-blue-700",
    resolved: "bg-green-50 text-green-700",
    closed: "bg-muted text-muted-foreground",
  };
  const label: Record<string, string> = {
    open: "Open", in_progress: "In progress", waiting: "Waiting", resolved: "Resolved", closed: "Closed",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${map[status] ?? "bg-muted"}`}>{label[status] ?? status}</span>;
}
