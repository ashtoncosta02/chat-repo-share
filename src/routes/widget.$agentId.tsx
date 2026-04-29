import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/widget/$agentId")({
  head: () => ({
    meta: [
      { title: "Chat" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: WidgetChat,
});

interface WidgetMessage {
  role: "user" | "assistant";
  content: string;
}

interface WidgetConfig {
  id: string;
  businessName: string;
  assistantName: string;
  tone: string | null;
  isLive: boolean;
  widgetColor: string;
  widgetGreeting: string | null;
  widgetPosition: "bottom-right" | "bottom-left";
}

function lighten(hex: string, amount = 0.18): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.min(255, Math.round(r + (255 - r) * amount));
  g = Math.min(255, Math.round(g + (255 - g) * amount));
  b = Math.min(255, Math.round(b + (255 - b) * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function getOrCreateSessionToken(agentId: string): string {
  const key = `af-widget-session:${agentId}`;
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

function WidgetChat() {
  const { agentId } = Route.useParams();
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionToken = useMemo(() => getOrCreateSessionToken(agentId), [agentId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/widget/config/${agentId}`)
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setConfigError(data?.error || "Failed to load");
          return;
        }
        setConfig(data);
        const greeting =
          (data.widgetGreeting && data.widgetGreeting.trim()) ||
          `Hi! I'm ${data.assistantName} from ${data.businessName}. How can I help you today?`;
        setMessages([{ role: "assistant", content: greeting }]);
      })
      .catch(() => {
        if (!cancelled) setConfigError("Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending || !config) return;

    setError(null);
    setInput("");
    const next: WidgetMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setSending(true);

    try {
      const resp = await fetch(`/api/public/widget/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          sessionToken,
          messages: next,
          pageUrl:
            typeof document !== "undefined"
              ? document.referrer || window.location.href
              : undefined,
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

      // Insert empty assistant slot
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

  function close() {
    if (typeof window !== "undefined" && window.parent !== window) {
      window.parent.postMessage({ type: "af-widget:close" }, "*");
    }
  }

  if (configError) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: "#666",
          padding: "20px",
          textAlign: "center",
        }}
      >
        Chat is unavailable right now.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#fff",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: "#1a1a1a",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          background: "linear-gradient(135deg, #b8893a, #d4a857)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 14, opacity: 0.9 }}>
            {config?.assistantName || "Assistant"}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {config?.businessName || "Loading…"}
          </div>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={close}
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "none",
            color: "#fff",
            width: 32,
            height: 32,
            borderRadius: 16,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          background: "#f7f5f0",
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                maxWidth: "80%",
                padding: "10px 14px",
                borderRadius: 14,
                background: m.role === "user" ? "#b8893a" : "#fff",
                color: m.role === "user" ? "#fff" : "#1a1a1a",
                fontSize: 14,
                lineHeight: 1.45,
                boxShadow:
                  m.role === "assistant"
                    ? "0 1px 2px rgba(0,0,0,0.06)"
                    : "none",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
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
        {sending && messages[messages.length - 1]?.role === "user" && (
          <div style={{ fontSize: 12, color: "#999", padding: "4px 6px" }}>
            Typing…
          </div>
        )}
        {error && (
          <div
            style={{
              padding: "10px 12px",
              background: "#fff1f0",
              color: "#a8071a",
              borderRadius: 8,
              fontSize: 13,
              marginTop: 8,
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={send}
        style={{
          padding: 12,
          borderTop: "1px solid #e7e3d8",
          background: "#fff",
          flexShrink: 0,
          display: "flex",
          gap: 8,
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message…"
          disabled={!config || sending}
          style={{
            flex: 1,
            border: "1px solid #e0dccf",
            borderRadius: 20,
            padding: "10px 14px",
            fontSize: 14,
            outline: "none",
            background: "#fafafa",
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending || !config}
          style={{
            background: "linear-gradient(135deg, #b8893a, #d4a857)",
            color: "#fff",
            border: "none",
            borderRadius: 20,
            padding: "0 18px",
            fontSize: 14,
            fontWeight: 600,
            cursor: input.trim() && !sending ? "pointer" : "default",
            opacity: input.trim() && !sending ? 1 : 0.6,
          }}
        >
          Send
        </button>
      </form>

      {/* Minimal markdown styling without Tailwind */}
      <style>{`
        .af-md p { margin: 0 0 6px 0; }
        .af-md p:last-child { margin-bottom: 0; }
        .af-md ul, .af-md ol { margin: 6px 0 6px 18px; padding: 0; }
        .af-md li { margin-bottom: 2px; }
        .af-md a { color: #b8893a; text-decoration: underline; }
        .af-md code { background: #f0ece1; padding: 1px 4px; border-radius: 3px; font-size: 12px; }
      `}</style>
    </div>
  );
}
