import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/PageHeader";
import { MessageSquare, ChevronRight, Mic, Trash2, RefreshCw, Phone as PhoneIcon, Search, PhoneCall, Bot, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { backfillVoiceCalls } from "@/lib/voice-call-backfill.functions";
import { summarizeConversation } from "@/lib/conversation-summary.functions";
import { aiCallbackLead } from "@/lib/lead-callback.functions";
import { startOutboundCall } from "@/lib/dialer.functions";
import { getAutoDeleteSetting, setAutoDeleteSetting } from "@/lib/thread-cleanup.functions";

const CALLBACK_KEY = "askkira.dialer.callback";

export const Route = createFileRoute("/dashboard/conversations/")({
  head: () => ({ meta: [{ title: "Threads — Ask Kira" }] }),
  component: ConversationsPage,
});

interface ConvRow {
  id: string;
  message_count: number;
  duration_seconds: number;
  started_at: string;
  agent_id: string | null;
  recording_url: string | null;
  ai_summary: string | null;
  lead_id: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  lead_email: string | null;
  lead_notes: string | null;
  lead_source: string | null;
  lead_status: string | null;
}


function ConversationsPage() {
  const { user } = useAuth();
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadConvs = async () => {
    const { data } = await supabase
      .from("conversations")
      .select("id, message_count, duration_seconds, started_at, agent_id, recording_url, ai_summary")
      .order("started_at", { ascending: false });
    const rows = data ?? [];
    const ids = rows.map((r) => r.id);
    const leadMap = new Map<
      string,
      { id: string; name: string | null; phone: string | null; email: string | null; notes: string | null; source: string | null; status: string | null }
    >();
    if (ids.length > 0) {
      const { data: leads } = await supabase
        .from("leads")
        .select("id, conversation_id, name, phone, email, notes, source, status")
        .in("conversation_id", ids);
      for (const l of leads ?? []) {
        if (l.conversation_id)
          leadMap.set(l.conversation_id, {
            id: l.id,
            name: l.name,
            phone: l.phone,
            email: l.email,
            notes: l.notes,
            source: l.source,
            status: l.status,
          });
      }
    }
    setConvs(
      rows.map((r) => {
        const l = leadMap.get(r.id);
        return {
          ...r,
          lead_id: l?.id ?? null,
          lead_name: l?.name ?? null,
          lead_phone: l?.phone ?? null,
          lead_email: l?.email ?? null,
          lead_notes: l?.notes ?? null,
          lead_source: l?.source ?? null,
          lead_status: l?.status ?? null,
        };
      })
    );
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    loadConvs();
  }, [user]);

  // Auto-generate AI summaries for conversations that don't have one yet.
  useEffect(() => {
    const missing = convs.filter((c) => !c.ai_summary && c.message_count > 0);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;
      for (const c of missing) {
        if (cancelled) return;
        try {
          const res = await summarizeConversation({
            data: { conversationId: c.id, accessToken: token },
          });
          if (res.success && !cancelled) {
            setConvs((prev) =>
              prev.map((row) => (row.id === c.id ? { ...row, ai_summary: res.summary } : row)),
            );
          }
        } catch {
          // ignore per-row failures
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convs.length]);

  const handleSync = async () => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      toast.error("Please sign in again.");
      return;
    }
    setSyncing(true);
    try {
      const res = await backfillVoiceCalls({ data: { accessToken: token } });
      if (res.success) {
        if (res.saved > 0) {
          toast.success(`Imported ${res.saved} call${res.saved === 1 ? "" : "s"}.`);
          await loadConvs();
        } else {
          toast.message("No new calls to import.");
        }
      } else {
        toast.error(res.error);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      toast.error("Could not delete conversation.");
      return;
    }
    setConvs((prev) => prev.filter((c) => c.id !== id));
    toast.success("Conversation deleted.");
  };

  const [callingId, setCallingId] = useState<string | null>(null);

  const updateLeadStatus = async (leadId: string, status: string) => {
    setConvs((prev) => prev.map((c) => (c.lead_id === leadId ? { ...c, lead_status: status } : c)));
    const { error } = await supabase.from("leads").update({ status }).eq("id", leadId);
    if (error) toast.error("Could not update status.");
  };

  const triggerAiCallback = async (leadId: string) => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return toast.error("Please sign in again.");
    setCallingId(leadId);
    try {
      const res = await aiCallbackLead({ data: { accessToken: token, leadId } });
      if (res.success) {
        toast.success("Receptionist is calling now.");
        setConvs((prev) =>
          prev.map((c) => (c.lead_id === leadId ? { ...c, lead_status: "contacted" } : c)),
        );
      } else toast.error(res.error);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start call.");
    } finally {
      setCallingId(null);
    }
  };

  const triggerHumanCallback = async (leadId: string, phone: string) => {
    const callback = (localStorage.getItem(CALLBACK_KEY) || "").trim();
    if (!callback) return toast.error("Set your callback number in the Dialer first (left sidebar).");
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return toast.error("Please sign in again.");
    setCallingId(leadId);
    try {
      const res = await startOutboundCall({
        data: { accessToken: token, to: phone, myPhone: callback },
      });
      if (res.success) {
        toast.success(`Ringing your phone (${callback})…`);
        setConvs((prev) =>
          prev.map((c) => (c.lead_id === leadId ? { ...c, lead_status: "contacted" } : c)),
        );
      } else toast.error(res.error);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start call.");
    } finally {
      setCallingId(null);
    }
  };

  const totalMs = convs.reduce((s, c) => s + c.message_count, 0);
  const avgMessages = convs.length ? Math.round(totalMs / convs.length) : 0;
  const totalDuration = convs.reduce((s, c) => s + c.duration_seconds, 0);
  const totalMin = Math.round(totalDuration / 60);

  const filteredConvs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return convs.filter((c) => {
      const matchesSearch = !q
        ? true
        : (c.lead_name ?? "").toLowerCase().includes(q) ||
          (c.lead_phone ?? "").toLowerCase().includes(q) ||
          (c.ai_summary ?? "").toLowerCase().includes(q) ||
          (c.lead_notes ?? "").toLowerCase().includes(q);
      const matchesIntent = intentFilter === "all" ? true : (c.lead_source ?? "") === intentFilter;
      const matchesStatus = statusFilter === "all" ? true : (c.lead_status ?? "") === statusFilter;
      return matchesSearch && matchesIntent && matchesStatus;
    });
  }, [convs, searchQuery, intentFilter, statusFilter]);

  const intentOptions = [
    { value: "all", label: "All Intents" },
    { value: "voice", label: "Voice Call" },
    { value: "widget", label: "Chat Widget" },
    { value: "manual", label: "Manual" },
    { value: "sms", label: "SMS" },
  ];

  const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "new", label: "New" },
    { value: "contacted", label: "Contacted" },
    { value: "booked", label: "Booked" },
    { value: "follow-up", label: "Follow-up" },
    { value: "resolved", label: "Resolved" },
    { value: "closed", label: "Closed" },
  ];
  return (
    <div>
      <PageHeader
        title="Threads"
        description="Every lead and conversation in one place — calls, chats, and bookings"
      />
      <div className="p-8 space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search callers or transcript words…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-3">
              <Select value={intentFilter} onValueChange={setIntentFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter by intent" />
                </SelectTrigger>
                <SelectContent>
                  {intentOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Importing…" : "Import recent calls"}
              </Button>
            </div>
          </div>
          {(searchQuery || intentFilter !== "all" || statusFilter !== "all") && (
            <p className="text-xs text-muted-foreground">
              Showing {filteredConvs.length} of {convs.length} conversations
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatRow label="Total Conversations" value={convs.length} color="text-foreground" />
          <StatRow label="Avg Messages" value={avgMessages} color="text-[var(--gold)]" />
          <StatRow label="Total Duration" value={`${totalMin}m`} color="text-emerald-600" />
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : convs.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-16 w-16 text-muted-foreground/40" />}
              title="No conversations yet"
              description="Conversations are saved here automatically every time someone talks to your AI receptionist."
            />
          ) : filteredConvs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-medium">No results match your filters</p>
              <p className="text-sm mt-1">Try adjusting your search or filter criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="px-6 py-3 font-medium">Caller</th>
                    <th className="px-4 py-3 font-medium">Intent</th>
                    <th className="px-4 py-3 font-medium">AI Summary</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-2 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredConvs.map((c) => (
                    <ConversationRow
                      key={c.id}
                      c={c}
                      deletingId={deletingId}
                      onDelete={handleDelete}
                      callingId={callingId}
                      onAiCallback={triggerAiCallback}
                      onHumanCallback={triggerHumanCallback}
                      onStatusChange={updateLeadStatus}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const LEAD_STATUS_OPTIONS = ["new", "contacted", "won", "lost"] as const;

function ConversationRow({
  c,
  deletingId,
  onDelete,
  callingId,
  onAiCallback,
  onHumanCallback,
  onStatusChange,
}: {
  c: ConvRow;
  deletingId: string | null;
  onDelete: (id: string) => void;
  callingId: string | null;
  onAiCallback: (leadId: string) => void;
  onHumanCallback: (leadId: string, phone: string) => void;
  onStatusChange: (leadId: string, status: string) => void;
}) {
  const displayName = c.lead_name ?? "Unknown Caller";
  const initials = c.lead_name
    ? c.lead_name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : null;
  const avatarColor = avatarBgFor(c.id);
  const isCalling = c.lead_id != null && callingId === c.lead_id;

  return (
    <tr className="hover:bg-muted/40 transition">
      <td className="px-6 py-4">
        <Link
          to="/dashboard/conversations/$conversationId"
          params={{ conversationId: c.id }}
          className="flex items-center gap-3"
        >
          <div
            className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold ${avatarColor}`}
          >
            {initials ?? <PhoneIcon className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-foreground truncate">{displayName}</div>
            <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
              {c.lead_phone ? (
                <>
                  <PhoneIcon className="h-3 w-3" />
                  {c.lead_phone}
                </>
              ) : (
                "No phone"
              )}
            </div>
            {c.lead_email && (
              <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {c.lead_email}
              </div>
            )}
          </div>
        </Link>
      </td>
      <td className="px-4 py-4">
        <IntentTag source={c.lead_source} />
      </td>
      <td className="px-4 py-4 max-w-sm">
        <p className="text-sm text-foreground/80 line-clamp-2">
          {c.ai_summary?.trim() ||
            c.lead_notes?.trim() ||
            (c.message_count > 0
              ? "Generating summary…"
              : `${c.message_count} messages · ${Math.round(c.duration_seconds / 60)}m call`)}
        </p>
        {c.recording_url && (
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[oklch(0.95_0.05_290)] text-[var(--gold)]">
            <Mic className="h-3 w-3" />
            Recording
          </span>
        )}
      </td>
      <td className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
        {formatTime(c.started_at)}
      </td>
      <td className="px-4 py-4">
        {c.lead_id ? (
          <Select value={c.lead_status ?? "new"} onValueChange={(v) => onStatusChange(c.lead_id!, v)}>
            <SelectTrigger className="h-8 w-28 text-xs capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <StatusTag status={c.lead_status} />
        )}
      </td>
      <td className="px-2 py-4 text-right">
        <div className="flex items-center justify-end gap-1">
          {c.lead_id && c.lead_phone && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={isCalling}>
                  {isCalling ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <PhoneCall className="h-3.5 w-3.5 mr-1" />
                  )}
                  Call back
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onHumanCallback(c.lead_id!, c.lead_phone!)}>
                  <PhoneIcon className="h-3.5 w-3.5 mr-2" />
                  Call from my phone
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAiCallback(c.lead_id!)}>
                  <Bot className="h-3.5 w-3.5 mr-2" />
                  Have receptionist call now
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                disabled={deletingId === c.id}
                aria-label="Delete conversation"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this thread?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove the transcript and any messages. This can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(c.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Link
            to="/dashboard/conversations/$conversationId"
            params={{ conversationId: c.id }}
            className="p-2 text-muted-foreground hover:text-foreground"
            aria-label="Open transcript"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </td>
    </tr>
  );
}

function IntentTag({ source }: { source: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    voice: { label: "Voice Call", cls: "bg-blue-100 text-blue-700" },
    widget: { label: "Chat Widget", cls: "bg-violet-100 text-violet-700" },
    manual: { label: "Manual", cls: "bg-amber-100 text-amber-700" },
    sms: { label: "SMS", cls: "bg-emerald-100 text-emerald-700" },
  };
  const key = (source ?? "").toLowerCase();
  const info = map[key] ?? { label: source ?? "General", cls: "bg-slate-100 text-slate-700" };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${info.cls}`}>
      {info.label}
    </span>
  );
}

function StatusTag({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    new: { label: "New", cls: "bg-sky-50 text-sky-700 border border-sky-200" },
    contacted: { label: "Contacted", cls: "bg-violet-50 text-violet-700 border border-violet-200" },
    booked: { label: "Booked", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
    "follow-up": { label: "Follow-up", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
    follow_up: { label: "Follow-up", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
    resolved: { label: "Resolved", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
    closed: { label: "Closed", cls: "bg-slate-50 text-slate-600 border border-slate-200" },
  };
  const key = (status ?? "").toLowerCase();
  const info = map[key] ?? { label: status ?? "Open", cls: "bg-slate-50 text-slate-600 border border-slate-200" };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${info.cls}`}>
      {info.label}
    </span>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yest.getFullYear() &&
    d.getMonth() === yest.getMonth() &&
    d.getDate() === yest.getDate();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + `, ${time}`;
}

function avatarBgFor(seed: string): string {
  const palette = [
    "bg-violet-100 text-violet-700",
    "bg-emerald-100 text-emerald-700",
    "bg-sky-100 text-sky-700",
    "bg-pink-100 text-pink-700",
    "bg-amber-100 text-amber-700",
    "bg-indigo-100 text-indigo-700",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function StatRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className={`font-display text-3xl font-semibold ${color}`}>{value}</span>
    </div>
  );
}
