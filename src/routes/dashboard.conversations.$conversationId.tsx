import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Bot, User as UserIcon, Clock, MessageSquare, Mic, Phone, MessageCircle, Loader2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  aiCallbackFromConversation,
  sendSmsFromConversation,
} from "@/lib/conversation-actions.functions";
import { getCallRecordingUrl } from "@/lib/call-recording.functions";
import { ThreadFeedbackCard } from "@/components/dashboard/ThreadFeedbackCard";
import { markThreadRead } from "@/lib/thread-read-state";

export const Route = createFileRoute("/dashboard/conversations/$conversationId")({
  head: () => ({ meta: [{ title: "Transcript — Ask Janice" }] }),
  component: ConversationDetailPage,
});

const CALL_PRESETS = [
  "Call and ask if they'd like to book an appointment.",
  "Follow up to answer any remaining questions they have.",
  "Confirm their preferred time and lock in a booking.",
  "Check in on pricing and see if they're ready to move forward.",
];

const SMS_PRESETS = [
  "Hi! Following up from our chat — would you like to book an appointment? Reply YES and I'll send times.",
  "Hey, just checking in — happy to answer any other questions you had. When's a good time to chat?",
  "Thanks for reaching out earlier! Let me know if you'd like to schedule a quick call.",
];


interface Conversation {
  id: string;
  agent_id: string | null;
  message_count: number;
  duration_seconds: number;
  started_at: string;
  ended_at: string | null;
  recording_url: string | null;
  lead_id?: string | null;
}

interface RelatedCall {
  id: string;
  started_at: string;
  duration_seconds: number;
  message_count: number;
  ai_summary: string | null;
}

interface LeadLite {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

interface AgentLite {
  id: string;
  business_name: string;
  assistant_name: string | null;
}

function ConversationDetailPage() {
  const { conversationId } = useParams({ from: "/dashboard/conversations/$conversationId" });
  const { user } = useAuth();
  const [conv, setConv] = useState<Conversation | null>(null);
  const [agent, setAgent] = useState<AgentLite | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [callInstructions, setCallInstructions] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [calling, setCalling] = useState(false);
  const [texting, setTexting] = useState(false);
  const [lead, setLead] = useState<LeadLite | null>(null);
  const [relatedCalls, setRelatedCalls] = useState<RelatedCall[]>([]);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const getRecordingUrlFn = useServerFn(getCallRecordingUrl);

  useEffect(() => {
    if (!conv?.recording_url) {
      setRecordingUrl(null);
      return;
    }
    let cancelled = false;
    getRecordingUrlFn({ data: { conversationId: conv.id } })
      .then((r) => { if (!cancelled) setRecordingUrl(r.url); })
      .catch(() => { if (!cancelled) setRecordingUrl(null); });
    return () => { cancelled = true; };
  }, [conv?.id, conv?.recording_url, getRecordingUrlFn]);
  const callFn = useServerFn(aiCallbackFromConversation);
  const smsFn = useServerFn(sendSmsFromConversation);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function handleCallback() {
    const instructions = callInstructions.trim();
    if (!instructions) {
      toast.error("Add an instruction or pick a suggestion first.");
      return;
    }
    const token = await getAccessToken();
    if (!token) return toast.error("You need to be signed in.");
    setCalling(true);
    try {
      const res = await callFn({ data: { accessToken: token, conversationId, instructions } });
      if (res.success) {
        toast.success("Calling the customer now.");
        setCallInstructions("");
      } else {
        toast.error(res.error);
      }
    } finally {
      setCalling(false);
    }
  }

  async function handleSendSms() {
    const message = smsMessage.trim();
    if (!message) {
      toast.error("Write a message or pick a template first.");
      return;
    }
    const token = await getAccessToken();
    if (!token) return toast.error("You need to be signed in.");
    setTexting(true);
    try {
      const res = await smsFn({ data: { accessToken: token, conversationId, message } });
      if (res.success) {
        toast.success("Text sent.");
        setSmsMessage("");
      } else {
        toast.error(res.error);
      }
    } finally {
      setTexting(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: c } = await supabase
        .from("conversations")
        .select("id, agent_id, message_count, duration_seconds, started_at, ended_at, recording_url, lead_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (cancelled) return;
      setConv(c ?? null);

      if (c?.agent_id) {
        const { data: a } = await supabase
          .from("agents")
          .select("id, business_name, assistant_name")
          .eq("id", c.agent_id)
          .maybeSingle();
        if (!cancelled) setAgent(a ?? null);
      }

      const { data: m } = await supabase
        .from("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        setMessages(m ?? []);
        setLoading(false);
      }

      // Find the lead linked to this conversation, then list every other
      // conversation tied to the same caller.
      let linkedLead: LeadLite | null = null;
      if (c?.lead_id) {
        const { data: l } = await supabase
          .from("leads")
          .select("id, name, phone, email")
          .eq("id", c.lead_id)
          .maybeSingle();
        linkedLead = l ?? null;
      }
      if (!linkedLead) {
        const { data: l } = await supabase
          .from("leads")
          .select("id, name, phone, email")
          .eq("conversation_id", conversationId)
          .maybeSingle();
        linkedLead = l ?? null;
      }
      if (cancelled) return;
      setLead(linkedLead);

      if (linkedLead) {
        // Match every lead that shares the same phone or email, then collect
        // every conversation tied to any of those leads (via lead_id OR the
        // legacy leads.conversation_id pointer).
        const orParts: string[] = [];
        if (linkedLead.phone) orParts.push(`phone.eq.${linkedLead.phone}`);
        if (linkedLead.email) orParts.push(`email.eq.${linkedLead.email}`);

        let matchingLeads: { id: string; conversation_id: string | null }[] = [
          { id: linkedLead.id, conversation_id: null },
        ];
        if (orParts.length > 0) {
          const { data: ml } = await supabase
            .from("leads")
            .select("id, conversation_id")
            .or(orParts.join(","));
          if (ml && ml.length > 0) matchingLeads = ml;
        }

        const leadIds = Array.from(new Set(matchingLeads.map((l) => l.id)));
        const legacyConvIds = Array.from(
          new Set(matchingLeads.map((l) => l.conversation_id).filter(Boolean) as string[])
        );

        const { data: byLead } = await supabase
          .from("conversations")
          .select("id, started_at, duration_seconds, message_count, ai_summary")
          .in("lead_id", leadIds);

        let byLegacy: RelatedCall[] = [];
        if (legacyConvIds.length > 0) {
          const { data } = await supabase
            .from("conversations")
            .select("id, started_at, duration_seconds, message_count, ai_summary")
            .in("id", legacyConvIds);
          byLegacy = data ?? [];
        }

        const merged = new Map<string, RelatedCall>();
        [...(byLead ?? []), ...byLegacy].forEach((c) => merged.set(c.id, c));
        const all = Array.from(merged.values()).sort(
          (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        );
        if (!cancelled) setRelatedCalls(all.filter((x) => x.id !== conversationId));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, conversationId]);

  if (loading) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  if (!conv) {
    return (
      <div className="p-12 text-center">
        <p className="text-muted-foreground mb-4">Conversation not found.</p>
        <Link to="/dashboard/conversations">
          <Button variant="outline">Back to Conversations</Button>
        </Link>
      </div>
    );
  }

  const minutes = Math.max(1, Math.round(conv.duration_seconds / 60));
  const assistantName = agent?.assistant_name?.trim() || "Janice";

  return (
    <div className="min-h-screen bg-background">
      <div className="px-8 pt-6 pb-4">
        <Link
          to="/dashboard/conversations"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Conversations
        </Link>
        <h1 className="font-display text-3xl font-bold text-foreground">
          {lead?.name || "Unknown caller"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {lead?.phone ? `${lead.phone} · ` : ""}
          {new Date(conv.started_at).toLocaleString()}
        </p>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Stat icon={<MessageSquare className="h-4 w-4" />} label={`${conv.message_count} messages`} />
          <Stat icon={<Clock className="h-4 w-4" />} label={`${minutes} min`} />
          {lead?.phone && <Stat icon={<Phone className="h-4 w-4" />} label={lead.phone} />}
          {lead?.email && <Stat icon={<MessageCircle className="h-4 w-4" />} label={lead.email} />}
          {agent && <Stat icon={<Bot className="h-4 w-4" />} label={assistantName} />}
        </div>

      </div>

      <div className="px-8 pb-12 space-y-6">
        {relatedCalls.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1">
              <History className="h-4 w-4 text-[var(--gold)]" />
              All interactions with {lead?.name || lead?.phone || "this caller"}
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Grouped by date. Click any past interaction to open it.
            </p>
            {(() => {
              const all = [
                {
                  id: conv.id,
                  started_at: conv.started_at,
                  duration_seconds: conv.duration_seconds,
                  message_count: conv.message_count,
                  ai_summary: null as string | null,
                  isCurrent: true,
                },
                ...relatedCalls.map((rc) => ({ ...rc, isCurrent: false })),
              ].sort(
                (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
              );

              const groups = new Map<string, typeof all>();
              all.forEach((item) => {
                const d = new Date(item.started_at);
                const key = d.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                });
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(item);
              });

              return (
                <div className="space-y-4">
                  {Array.from(groups.entries()).map(([date, items]) => (
                    <div key={date}>
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        {date}
                      </div>
                      <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                        {items.map((it) => {
                          const mins = Math.max(1, Math.round(it.duration_seconds / 60));
                          const time = new Date(it.started_at).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          });
                          const inner = (
                            <div className="flex items-start justify-between gap-4 px-3 py-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-foreground flex items-center gap-2">
                                  {time}
                                  {it.isCurrent && (
                                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[var(--gold)] text-white">
                                      Viewing
                                    </span>
                                  )}
                                </div>
                                {it.ai_summary && (
                                  <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                    {it.ai_summary}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground shrink-0 text-right">
                                <div>{it.message_count} msgs</div>
                                <div>{mins} min</div>
                              </div>
                            </div>
                          );
                          return (
                            <li key={it.id} className={it.isCurrent ? "bg-muted/40" : ""}>
                              {it.isCurrent ? (
                                inner
                              ) : (
                                <Link
                                  to="/dashboard/conversations/$conversationId"
                                  params={{ conversationId: it.id }}
                                  className="block hover:bg-muted/40 transition-colors"
                                >
                                  {inner}
                                </Link>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {conv.recording_url && recordingUrl && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
              <Mic className="h-4 w-4 text-[var(--gold)]" />
              Call recording
            </div>
            <audio
              controls
              preload="metadata"
              src={recordingUrl}
              className="w-full"
            >
              Your browser does not support the audio element.
            </audio>
          </div>
        )}
        <div className="rounded-xl border border-border bg-card p-6">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              No messages recorded for this conversation.
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((m, idx) => {
                const isUser = m.role === "user";
                const d = new Date(m.created_at);
                const ts = d.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                });
                const dayKey = d.toDateString();
                const prevDayKey =
                  idx > 0 ? new Date(messages[idx - 1].created_at).toDateString() : null;
                const showDaySeparator = dayKey !== prevDayKey;
                const dayLabel = d.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                });
                return (
                  <div key={m.id}>
                    {showDaySeparator && (
                      <div className="flex items-center gap-3 my-4 first:mt-0">
                        <div className="flex-1 h-px bg-border" />
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {dayLabel}
                        </div>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}
                    <div
                      className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}
                    >
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                          isUser
                            ? "bg-muted text-muted-foreground"
                            : "bg-[oklch(0.95_0.05_290)] text-[var(--gold)]"
                        }`}
                      >
                        {isUser ? <UserIcon className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                      </div>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                          isUser
                            ? "bg-[var(--gold)] text-white"
                            : "bg-background border border-border text-foreground"
                        }`}
                      >
                        <div className="text-xs font-semibold uppercase tracking-wider mb-1 opacity-70">
                          {isUser ? "Caller" : assistantName}
                        </div>
                        <div className="whitespace-pre-wrap">{m.content}</div>
                        <div
                          className={`text-xs mt-1 ${
                            isUser ? "text-white/70" : "text-muted-foreground"
                          }`}
                        >
                          {ts}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>


        {/* Follow-up actions */}
        <div className="grid md:grid-cols-2 gap-5">
          {/* AI Callback */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1">
              <Phone className="h-4 w-4 text-[var(--gold)]" />
              Have {assistantName} call back
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Pick a suggestion or write what you want the call to accomplish.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {CALL_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCallInstructions(p)}
                  className="text-xs px-2.5 py-1.5 rounded-full border border-border bg-background hover:bg-muted text-foreground text-left"
                >
                  {p}
                </button>
              ))}
            </div>
            <Textarea
              value={callInstructions}
              onChange={(e) => setCallInstructions(e.target.value)}
              placeholder="e.g. Confirm if they want a Tuesday or Thursday booking and lock it in."
              rows={3}
              className="mb-3"
            />
            <Button onClick={handleCallback} disabled={calling} className="w-full">
              {calling ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Placing call…</>
              ) : (
                <><Phone className="h-4 w-4 mr-2" /> Call customer back</>
              )}
            </Button>
          </div>

          {/* SMS */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1">
              <MessageCircle className="h-4 w-4 text-[var(--gold)]" />
              Send a text message
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Sends from your connected business number.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {SMS_PRESETS.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSmsMessage(p)}
                  className="text-xs px-2.5 py-1.5 rounded-full border border-border bg-background hover:bg-muted text-foreground text-left"
                >
                  {p.length > 60 ? p.slice(0, 60) + "…" : p}
                </button>
              ))}
            </div>
            <Textarea
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value.slice(0, 1500))}
              placeholder="Write the text you'd like to send…"
              rows={3}
              className="mb-2"
            />
            <div className="text-xs text-muted-foreground text-right mb-2">
              {smsMessage.length}/1500
            </div>
            <Button onClick={handleSendSms} disabled={texting} className="w-full">
              {texting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>
              ) : (
                <><MessageCircle className="h-4 w-4 mr-2" /> Send text</>
              )}
            </Button>
          </div>
        </div>

        {conv.agent_id && (
          <ThreadFeedbackCard
            agentId={conv.agent_id}
            conversationId={conv.id}
          />
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-foreground">
      {icon}
      {label}
    </span>
  );
}
