import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Code2, Copy, Check, ExternalLink, Plus, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/chat-widget")({
  head: () => ({ meta: [{ title: "Chat Widget — Agent Factory" }] }),
  component: ChatWidgetPage,
});

interface AgentRow {
  id: string;
  business_name: string;
  is_live: boolean;
  widget_color: string | null;
  widget_greeting: string | null;
  widget_position: "bottom-right" | "bottom-left" | null;
}

const PRESET_COLORS = [
  "#b8893a", // gold (default)
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#6366f1", // indigo
  "#ec4899", // pink
  "#ef4444", // red
  "#f59e0b", // amber
  "#1f2937", // slate
];

export function ChatWidgetPage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState<"script" | "tag" | null>(null);

  // Draft customization state (per selected agent)
  const [draftColor, setDraftColor] = useState("#b8893a");
  const [draftGreeting, setDraftGreeting] = useState("");
  const [draftPosition, setDraftPosition] = useState<"bottom-right" | "bottom-left">("bottom-right");
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("agents")
      .select("id, business_name, is_live, widget_color, widget_greeting, widget_position")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []) as AgentRow[];
        setAgents(rows);
        setSelectedId((prev) => prev ?? rows[0]?.id ?? null);
        setLoading(false);
      });
  }, [user]);

  const selected = useMemo(
    () => agents.find((a) => a.id === selectedId) ?? null,
    [agents, selectedId]
  );

  // Sync draft when agent selection changes
  useEffect(() => {
    if (!selected) return;
    setDraftColor(selected.widget_color || "#b8893a");
    setDraftGreeting(selected.widget_greeting || "");
    setDraftPosition((selected.widget_position as "bottom-right" | "bottom-left") || "bottom-right");
  }, [selected]);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  const scriptTag = selected
    ? `<script src="${origin}/api/public/widget/embed.js?agent=${selected.id}" async></script>`
    : "";

  const previewUrl = selected ? `/widget/${selected.id}` : "";

  const isDirty =
    !!selected &&
    (draftColor !== (selected.widget_color || "#b8893a") ||
      draftGreeting !== (selected.widget_greeting || "") ||
      draftPosition !== ((selected.widget_position as string) || "bottom-right"));

  async function copy(value: string, kind: "script" | "tag") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Couldn't copy. Select and copy manually.");
    }
  }

  async function saveCustomization() {
    if (!selected) return;
    if (!/^#[0-9a-f]{6}$/i.test(draftColor)) {
      toast.error("Color must be a 6-digit hex like #b8893a");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("agents")
      .update({
        widget_color: draftColor,
        widget_greeting: draftGreeting.trim() || null,
        widget_position: draftPosition,
      })
      .eq("id", selected.id);
    setSaving(false);
    if (error) {
      toast.error("Couldn't save changes");
      return;
    }
    setAgents((prev) =>
      prev.map((a) =>
        a.id === selected.id
          ? {
              ...a,
              widget_color: draftColor,
              widget_greeting: draftGreeting.trim() || null,
              widget_position: draftPosition,
            }
          : a
      )
    );
    setPreviewKey((k) => k + 1);
    toast.success("Widget updated");
  }

  return (
    <div>
      <PageHeader
        title="Chat Widget"
        description="Embed an AI chat assistant on your website. One line of code."
      />

      <div className="px-4 py-6 md:px-8 md:py-8 max-w-6xl">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : agents.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-10 w-10 text-muted-foreground" />}
            title="No agents yet"
            description="Create an agent first — the chat widget uses your agent's business info, services, and FAQs to answer visitors."
            action={
              <Link to="/dashboard/new-agent">
                <Button className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white">
                  <Plus className="mr-2 h-4 w-4" /> Create Agent
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
            {/* Left: configuration */}
            <div className="space-y-6">
              {/* Agent picker */}
              <div className="rounded-xl border border-border bg-card p-5">
                <label className="text-sm font-medium text-foreground block mb-2">
                  Agent
                </label>
                <select
                  value={selectedId ?? ""}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.business_name}
                      {a.is_live ? "" : " (draft)"}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-muted-foreground">
                  The widget uses this agent's business info, services, FAQs,
                  and tone to answer questions.
                </p>
              </div>

              {/* Customization */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-5">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Customize appearance
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Match the widget to your brand. Changes apply instantly to embedded sites.
                  </p>
                </div>

                {/* Color */}
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">
                    Brand color
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setDraftColor(c)}
                        aria-label={`Use color ${c}`}
                        className={`h-8 w-8 rounded-full border-2 transition-transform ${
                          draftColor.toLowerCase() === c.toLowerCase()
                            ? "border-foreground scale-110"
                            : "border-transparent hover:scale-105"
                        }`}
                        style={{ background: c }}
                      />
                    ))}
                    <div className="flex items-center gap-2 ml-1">
                      <input
                        type="color"
                        value={draftColor}
                        onChange={(e) => setDraftColor(e.target.value)}
                        className="h-8 w-8 rounded cursor-pointer border border-border bg-transparent"
                        aria-label="Pick custom color"
                      />
                      <input
                        type="text"
                        value={draftColor}
                        onChange={(e) => setDraftColor(e.target.value)}
                        className="w-24 rounded-md border border-border bg-background px-2 py-1 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>

                {/* Greeting */}
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">
                    Greeting message
                  </label>
                  <textarea
                    value={draftGreeting}
                    onChange={(e) => setDraftGreeting(e.target.value)}
                    placeholder={
                      selected
                        ? `Hi! I'm ${selected.business_name}'s assistant. How can I help?`
                        : ""
                    }
                    rows={2}
                    maxLength={300}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 resize-none"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Leave blank to use the default greeting. {draftGreeting.length}/300
                  </p>
                </div>

                {/* Position */}
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">
                    Bubble position
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["bottom-right", "bottom-left"] as const).map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => setDraftPosition(pos)}
                        className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                          draftPosition === pos
                            ? "border-[var(--gold)] bg-[oklch(0.96_0.04_75)] text-foreground font-medium"
                            : "border-border bg-background text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {pos === "bottom-right" ? "Bottom right" : "Bottom left"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  {isDirty && (
                    <span className="text-xs text-muted-foreground mr-auto">
                      Unsaved changes
                    </span>
                  )}
                  <Button
                    onClick={saveCustomization}
                    disabled={!isDirty || saving}
                    className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white"
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </div>


              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Code2 className="h-4 w-4 text-[var(--gold)]" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Embed code
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Paste this single line just before <code className="rounded bg-muted px-1 py-0.5 text-xs">{`</body>`}</code>{" "}
                  on every page where you want the chat bubble to appear.
                </p>
                <div className="relative">
                  <pre className="rounded-lg bg-[oklch(0.18_0.01_85)] text-[oklch(0.96_0.02_85)] p-4 text-xs overflow-x-auto font-mono leading-relaxed">
                    {scriptTag}
                  </pre>
                  <button
                    type="button"
                    onClick={() => copy(scriptTag, "tag")}
                    className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-md bg-white/10 hover:bg-white/20 px-2 py-1 text-xs text-white transition-colors"
                  >
                    {copied === "tag" ? (
                      <>
                        <Check className="h-3 w-3" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Setup steps */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground mb-3">
                  Quick setup
                </h2>
                <ol className="space-y-3 text-sm text-foreground/90">
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[oklch(0.96_0.04_75)] text-xs font-semibold text-[var(--gold-foreground)]">
                      1
                    </span>
                    <span>Copy the embed code above.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[oklch(0.96_0.04_75)] text-xs font-semibold text-[var(--gold-foreground)]">
                      2
                    </span>
                    <span>
                      Paste it inside the <code className="rounded bg-muted px-1 py-0.5 text-xs">{`<body>`}</code> of
                      your website (most platforms have a "custom code" or
                      "footer scripts" field).
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[oklch(0.96_0.04_75)] text-xs font-semibold text-[var(--gold-foreground)]">
                      3
                    </span>
                    <span>
                      Refresh your site — a chat bubble appears in the bottom
                      right corner.
                    </span>
                  </li>
                </ol>
                <div className="mt-4 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                  <strong className="text-foreground">Works on:</strong>{" "}
                  WordPress, Wix, Squarespace, Webflow, Shopify, plain HTML — anywhere
                  you can paste a script tag.
                </div>
              </div>
            </div>

            {/* Right: live preview */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  Live preview
                </h2>
                {previewUrl && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[var(--gold)] hover:underline"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="rounded-xl border border-border bg-[oklch(0.96_0.012_85)] overflow-hidden h-[560px] flex items-end justify-end p-5">
                {previewUrl && (
                  <iframe
                    key={previewUrl}
                    src={previewUrl}
                    title="Widget preview"
                    className="w-full max-w-[360px] h-full rounded-2xl bg-white shadow-2xl border-none"
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                This is exactly what your visitors see when they open the chat.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
