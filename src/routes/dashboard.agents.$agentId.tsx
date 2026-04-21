import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { chatWithAgent } from "@/server/agent-chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Send, Bot, ArrowLeft, Calendar, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/agents/$agentId")({
  head: () => ({ meta: [{ title: "Agent — Agent Factory" }] }),
  component: AgentDetailPage,
});

interface Agent {
  id: string;
  business_name: string;
  industry: string | null;
  tone: string | null;
  primary_goal: string | null;
  services: string | null;
  booking_link: string | null;
  emergency_number: string | null;
  faqs: string | null;
  pricing_notes: string | null;
  escalation_triggers: string | null;
  is_live: boolean;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  ts: Date;
}

// Friendly human names — picked deterministically per agent so it's stable
const ASSISTANT_NAMES = [
  "Ava", "Olivia", "Mia", "Sophia", "Lily",
  "Ethan", "Noah", "Liam", "Owen", "Leo",
];

function pickName(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ASSISTANT_NAMES[h % ASSISTANT_NAMES.length];
}

function AgentDetailPage() {
  const { agentId } = useParams({ from: "/dashboard/agents/$agentId" });
  const { user } = useAuth();
  const chat = useServerFn(chatWithAgent);

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const assistantName = useMemo(
    () => (agent ? pickName(agent.id) : "Ava"),
    [agent],
  );

  // Load agent
  useEffect(() => {
    if (!user) return;
    supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAgent(data as Agent);
          setMessages([
            {
              role: "assistant",
              content: `Hi there! I'm ${pickName(data.id)}, here to help you with ${data.business_name}. How can I help you today?`,
              ts: new Date(),
            },
          ]);
        }
        setLoading(false);
      });
  }, [agentId, user]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || !agent || sending) return;
    const userMsg: Msg = { role: "user", content: text.trim(), ts: new Date() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);
    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const res = await chat({
        data: {
          agent: { ...agent, assistant_name: assistantName },
          messages: history,
        },
      });
      if (!res.success) {
        toast.error(res.error);
        setSending(false);
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: res.reply, ts: new Date() }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setSending(false);
    }
  };

  const suggestions = [
    "What are your hours?",
    "How do I book?",
    "What services do you offer?",
    "Do you handle emergencies?",
    "Where are you located?",
  ];

  if (loading) {
    return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  }
  if (!agent) {
    return (
      <div className="p-12 text-center">
        <p className="text-muted-foreground mb-4">Agent not found.</p>
        <Link to="/dashboard">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="px-8 pt-6 pb-4 flex items-start justify-between">
        <div>
          <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <h1 className="font-display text-3xl font-bold text-foreground">{agent.business_name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {assistantName} · AI Receptionist
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-medium text-emerald-700">Live</span>
        </div>
      </div>

      {/* Chat surface */}
      <div className="flex-1 px-8 pb-4">
        <div ref={scrollRef} className="h-[42vh] overflow-y-auto space-y-4 py-4">
          {messages.map((m, i) => (
            <MessageBubble key={i} msg={m} />
          ))}
          {sending && (
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[oklch(0.95_0.05_75)] flex items-center justify-center">
                <Bot className="h-5 w-5 text-[var(--gold)]" />
              </div>
              <div className="bg-card border border-border rounded-2xl px-4 py-3 text-sm text-muted-foreground">
                Typing…
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Suggestions */}
      <div className="px-8 pb-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Try Asking
        </p>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={sending}
              className="px-4 py-2 rounded-full border border-border bg-card text-sm text-foreground hover:bg-muted transition disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Voice / input panel */}
      <div className="border-t border-border bg-card">
        <div className="px-8 py-6">
          {/* Visualizer */}
          <div className="flex justify-center gap-1 mb-4 h-6 items-end">
            {Array.from({ length: 32 }).map((_, i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-[var(--gold)]/60"
                style={{
                  height: `${6 + Math.abs(Math.sin((i + (sending ? Date.now() / 200 : 0)) * 0.6)) * 16}px`,
                }}
              />
            ))}
          </div>

          {/* Mic */}
          <div className="flex flex-col items-center mb-4">
            <button
              type="button"
              onClick={() => toast("Voice mode coming soon — type below for now")}
              className="h-16 w-16 rounded-full bg-card border-2 border-border hover:border-[var(--gold)] flex items-center justify-center transition shadow-sm"
              aria-label="Tap to speak"
            >
              <Mic className="h-7 w-7 text-foreground" />
            </button>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-2">
              Tap to Speak
            </span>
          </div>

          {/* Type input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 max-w-2xl mx-auto"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message…"
              disabled={sending}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={sending || !input.trim()}
              className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>

          {/* Footer chips */}
          <div className="flex justify-center gap-6 mt-4 text-xs text-muted-foreground">
            {agent.primary_goal && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Available now
              </span>
            )}
            {agent.booking_link && (
              <a
                href={agent.booking_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-[var(--gold)]"
              >
                <Calendar className="h-3.5 w-3.5" /> Book Online
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  const time = msg.ts.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && (
        <div className="h-9 w-9 rounded-full bg-[oklch(0.95_0.05_75)] flex items-center justify-center shrink-0">
          <Bot className="h-5 w-5 text-[var(--gold)]" />
        </div>
      )}
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? "bg-[var(--gold)] text-white"
            : "bg-card border border-border text-foreground"
        }`}
      >
        <div className="whitespace-pre-wrap">{msg.content}</div>
        <div className={`text-xs mt-1 ${isUser ? "text-white/70" : "text-muted-foreground"}`}>
          {time}
        </div>
      </div>
    </div>
  );
}
