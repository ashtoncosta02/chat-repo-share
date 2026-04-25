import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { MessageSquare, X, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AgentOption {
  id: string;
  business_name: string;
  assistant_name: string | null;
  is_live: boolean;
}

const STARTERS = [
  "What services does this business offer?",
  "How can I book or request a follow-up?",
  "What should I know before getting started?",
];

function getSessionToken(agentId: string | null): string {
  const key = `af-dashboard-business-chat:${agentId || "none"}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const token =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(key, token);
    return token;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function getStorageKey(agentId: string | null) {
  return `af-business-chat-messages:${agentId || "none"}`;
}

export function OwnerChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedId) ?? null,
    [agents, selectedId]
  );

  const sessionToken = useMemo(() => getSessionToken(selectedId), [selectedId]);
  const storageKey = useMemo(() => getStorageKey(selectedId), [selectedId]);

  useEffect(() => {
    if (!user) return;
    setAgentsLoading(true);
    supabase
      .from("agents")
      .select("id, business_name, assistant_name, is_live")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const rows = data ?? [];
        setAgents(rows);
        setSelectedId((prev) => prev ?? rows[0]?.id ?? null);
        setAgentsLoading(false);
      });
  }, [user]);

  useEffect(() => {
    if (!selectedAgent) {
      setMessages([]);
      return;
    }

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {
      /* ignore */
    }

    setMessages([
      {
        role: "assistant",
        content: `Hi! I'm ${selectedAgent.assistant_name || "the assistant"} for ${selectedAgent.business_name}. What can I help you with today?`,
      },
    ]);
  }, [selectedAgent, storageKey]);

  useEffect(() => {
    if (!selectedAgent) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)));
    } catch {
      /* ignore */
    }
  }, [messages, selectedAgent, storageKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending || !selectedAgent) return;

    setError(null);
    setInput("");
    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setSending(true);

    try {
      const resp = await fetch("/api/public/widget/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          sessionToken,
          messages: next,
          pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });

      if (!resp.ok || !resp.body) {
        let msg = `Something went wrong (${resp.status})`;
        try {
          const j = await resp.json();
          if (j?.error) msg = j.error;
        } catch {
          /* ignore */
        }
        setError(msg);
        setSending(false);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let acc = "";
      let done = false;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        textBuffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, nl);
          textBuffer = textBuffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === "string") {
              acc += delta;
              setMessages((prev) => {
                const copy = prev.slice();
                const last = copy[copy.length - 1];
                if (last && last.role === "assistant") {
                  copy[copy.length - 1] = { ...last, content: acc };
                }
                return copy;
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  function clearChat() {
    setMessages(
      selectedAgent
        ? [
            {
              role: "assistant",
              content: `Hi! I'm ${selectedAgent.assistant_name || "the assistant"} for ${selectedAgent.business_name}. What can I help you with today?`,
            },
          ]
        : []
    );
    setError(null);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      {open && (
        <div
          className="fixed bottom-24 right-4 md:right-6 z-30 w-[calc(100vw-2rem)] sm:w-[380px] h-[min(560px,calc(100vh-8rem))] rounded-2xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
          role="dialog"
          aria-label="Business chat"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-[var(--gold)] to-[oklch(0.78_0.13_75)] text-white flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-4 w-4 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">
                  {selectedAgent?.assistant_name || "Business Assistant"}
                </div>
                <div className="text-[11px] opacity-90 truncate">
                  {selectedAgent?.business_name || "Ask about your business"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={clearChat}
                  className="text-[11px] rounded-md px-2 py-1 bg-white/15 hover:bg-white/25 transition-colors"
                  aria-label="Clear conversation"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close business chat"
                className="rounded-md p-1.5 hover:bg-white/15 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {agents.length > 1 && (
            <div className="border-b border-border bg-card px-3 py-2">
              <select
                value={selectedId ?? ""}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
                aria-label="Choose business agent"
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.business_name}{agent.is_live ? "" : " (draft)"}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-3 bg-[oklch(0.97_0.012_85)] space-y-2"
          >
            {agentsLoading ? (
              <div className="rounded-lg bg-card border border-border p-3 text-sm text-muted-foreground">
                Loading chat…
              </div>
            ) : !selectedAgent ? (
              <div className="rounded-lg bg-card border border-border p-3 text-sm text-foreground">
                Create an agent first, then this bubble will answer customer questions about that business.
              </div>
            ) : (
              <>
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm whitespace-pre-wrap break-words ${
                        m.role === "user"
                          ? "bg-[var(--gold)] text-white"
                          : "bg-card text-foreground border border-border"
                      }`}
                    >
                      {m.role === "assistant" ? (
                        <div className="af-md">
                          <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                        </div>
                      ) : (
                        m.content
                      )}
                    </div>
                  </div>
                ))}

                {messages.length <= 1 && !sending && (
                  <div className="space-y-1.5 pt-1">
                    {STARTERS.map((starter) => (
                      <button
                        key={starter}
                        type="button"
                        onClick={() => void ask(starter)}
                        className="w-full text-left text-sm rounded-lg border border-border bg-card hover:bg-muted px-3 py-2 transition-colors"
                      >
                        {starter}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {sending && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-2xl px-3 py-2 text-sm text-muted-foreground shadow-sm">
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-destructive/10 text-destructive text-xs px-3 py-2">
                {error}
              </div>
            )}
          </div>

          <form
            onSubmit={onSubmit}
            className="flex-shrink-0 flex gap-2 p-3 border-t border-border bg-card"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about the business…"
              disabled={sending || !selectedAgent}
              className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 disabled:opacity-60"
              maxLength={2000}
            />
            <button
              type="submit"
              disabled={!input.trim() || sending || !selectedAgent}
              aria-label="Send"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--gold)] text-white hover:bg-[var(--gold)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          <style>{`
            .af-md p { margin: 0 0 6px 0; }
            .af-md p:last-child { margin-bottom: 0; }
            .af-md ul, .af-md ol { margin: 6px 0 6px 18px; padding: 0; }
            .af-md li { margin-bottom: 2px; }
            .af-md a { color: var(--gold); text-decoration: underline; }
            .af-md code { background: oklch(0.94 0.012 85); padding: 1px 4px; border-radius: 3px; font-size: 12px; }
            .af-md strong { font-weight: 600; }
          `}</style>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close business chat" : "Open business chat"}
        aria-expanded={open}
        className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--gold)] text-white shadow-lg hover:scale-105 transition-transform"
      >
        {open ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </button>
    </>
  );
}
