import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Bot, User as UserIcon, Clock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/conversations/$conversationId")({
  head: () => ({ meta: [{ title: "Transcript — Agent Factory" }] }),
  component: ConversationDetailPage,
});

interface Conversation {
  id: string;
  agent_id: string | null;
  message_count: number;
  duration_seconds: number;
  started_at: string;
  ended_at: string | null;
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

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: c } = await supabase
        .from("conversations")
        .select("id, agent_id, message_count, duration_seconds, started_at, ended_at")
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
  const assistantName = agent?.assistant_name?.trim() || "Ava";

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
          {agent ? agent.business_name : "Conversation"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {new Date(conv.started_at).toLocaleString()}
        </p>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Stat icon={<MessageSquare className="h-4 w-4" />} label={`${conv.message_count} messages`} />
          <Stat icon={<Clock className="h-4 w-4" />} label={`${minutes} min`} />
          {agent && <Stat icon={<Bot className="h-4 w-4" />} label={assistantName} />}
        </div>
      </div>

      <div className="px-8 pb-12">
        <div className="rounded-xl border border-border bg-card p-6">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              No messages recorded for this conversation.
            </div>
          ) : (
            <ol className="space-y-5">
              {messages.map((m) => {
                const isUser = m.role === "user";
                const ts = new Date(m.created_at).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                });
                return (
                  <li
                    key={m.id}
                    className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                        isUser
                          ? "bg-muted text-muted-foreground"
                          : "bg-[oklch(0.95_0.05_75)] text-[var(--gold)]"
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
                  </li>
                );
              })}
            </ol>
          )}
        </div>
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
