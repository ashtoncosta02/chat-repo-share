import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/PageHeader";
import { User, Phone, Mail, MessageSquare, Search, PhoneCall, Bot, Loader2, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { aiCallbackLead } from "@/server/lead-callback.functions";

export const Route = createFileRoute("/dashboard/leads")({
  head: () => ({ meta: [{ title: "Leads — Agent Factory" }] }),
  component: LeadsPage,
});

interface LeadRow {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: string;
  source: string | null;
  agent_id: string | null;
  conversation_id: string | null;
  created_at: string;
  last_message_at: string | null;
}

interface AgentOpt {
  id: string;
  business_name: string;
}

const STATUS_OPTIONS = ["new", "contacted", "won", "lost"] as const;

function statusVariant(s: string): "default" | "secondary" | "outline" | "destructive" {
  if (s === "won") return "default";
  if (s === "lost") return "destructive";
  if (s === "contacted") return "secondary";
  return "outline";
}

function LeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [agents, setAgents] = useState<AgentOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const [leadsRes, agentsRes] = await Promise.all([
      supabase
        .from("leads")
        .select(
          "id, name, phone, email, notes, status, source, agent_id, conversation_id, created_at, last_message_at",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("agents").select("id, business_name").order("business_name"),
    ]);
    setLeads(leadsRes.data ?? []);
    setAgents(agentsRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  const updateStatus = async (id: string, status: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    await supabase.from("leads").update({ status }).eq("id", id);
  };

  const [callingId, setCallingId] = useState<string | null>(null);
  const triggerAiCallback = async (leadId: string) => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      toast.error("Please sign in again.");
      return;
    }
    setCallingId(leadId);
    try {
      const res = await aiCallbackLead({ data: { accessToken: token, leadId } });
      if (res.success) {
        toast.success("Receptionist is calling now.");
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, status: "contacted" } : l)),
        );
      } else {
        toast.error(res.error);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start call.");
    } finally {
      setCallingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (agentFilter !== "all" && l.agent_id !== agentFilter) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (q) {
        const hay = `${l.name ?? ""} ${l.email ?? ""} ${l.phone ?? ""} ${l.notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, agentFilter, statusFilter]);

  const agentName = (id: string | null) =>
    id ? agents.find((a) => a.id === id)?.business_name ?? "—" : "—";

  const stats = useMemo(
    () => ({
      total: leads.length,
      new: leads.filter((l) => l.status === "new").length,
      won: leads.filter((l) => l.status === "won").length,
      withContact: leads.filter((l) => l.email || l.phone).length,
    }),
    [leads],
  );

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Contact info captured automatically from chats, calls, and bookings"
      />
      <div className="p-4 md:p-8 space-y-4 md:space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Total" value={stats.total} />
          <Stat label="New" value={stats.new} />
          <Stat label="Booked" value={stats.won} accent="text-emerald-600" />
          <Stat label="With Contact" value={stats.withContact} />
        </div>

        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, phone, notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="md:w-56">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.business_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="md:w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border border-border bg-card">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<User className="h-16 w-16 text-muted-foreground/40" />}
              title={leads.length === 0 ? "No leads yet" : "No leads match your filters"}
              description={
                leads.length === 0
                  ? "Leads show up here automatically when someone shares contact info with your agent or books an appointment."
                  : "Try clearing the search or filters."
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((l) => (
                <li key={l.id} className="px-4 md:px-6 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground truncate">
                          {l.name ?? "Unknown"}
                        </span>
                        <Badge variant={statusVariant(l.status)} className="capitalize">
                          {l.status}
                        </Badge>
                        {l.source && (
                          <span className="text-xs text-muted-foreground capitalize">
                            via {l.source}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                        {l.phone && (
                          <a
                            href={`tel:${l.phone}`}
                            className="flex items-center gap-1 hover:text-[var(--gold)]"
                          >
                            <Phone className="h-3 w-3" />
                            {l.phone}
                          </a>
                        )}
                        {l.email && (
                          <a
                            href={`mailto:${l.email}`}
                            className="flex items-center gap-1 hover:text-[var(--gold)] break-all"
                          >
                            <Mail className="h-3 w-3" />
                            {l.email}
                          </a>
                        )}
                        <span>· {agentName(l.agent_id)}</span>
                      </div>
                      {l.notes && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {l.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {new Date(l.created_at).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-1">
                        {l.phone && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" disabled={callingId === l.id}>
                                {callingId === l.id ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                ) : (
                                  <PhoneCall className="h-3.5 w-3.5 mr-1" />
                                )}
                                Call back
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <a href={`tel:${l.phone}`}>
                                  <Phone className="h-3.5 w-3.5 mr-2" />
                                  Call from my phone
                                </a>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => triggerAiCallback(l.id)}>
                                <Bot className="h-3.5 w-3.5 mr-2" />
                                Have receptionist call now
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {l.conversation_id && (
                          <Button asChild variant="ghost" size="sm">
                            <Link
                              to="/dashboard/conversations/$conversationId"
                              params={{ conversationId: l.conversation_id }}
                            >
                              <MessageSquare className="h-3.5 w-3.5 mr-1" />
                              Chat
                            </Link>
                          </Button>
                        )}
                        <Select
                          value={l.status}
                          onValueChange={(v) => updateStatus(l.id, v)}
                        >
                          <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s} className="capitalize">
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className={`font-display text-2xl font-semibold ${accent ?? "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
