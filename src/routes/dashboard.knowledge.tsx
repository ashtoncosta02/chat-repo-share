import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus,
  X as XIcon,
  MessageSquare,
  Loader2,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  ArrowLeft,
  HelpCircle,
  Layers,
  Phone,
  Calendar,
  GripVertical,
  Check,
  Briefcase,
  DollarSign,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

import { syncReceptionistAgent } from "@/lib/elevenlabs-agent.functions";
import { suggestFaqs, type SuggestedFaq } from "@/lib/faq-suggest.functions";
import { coerceFaqs, newFaq, type StructuredFaq } from "@/lib/faqs";
import {
  coerceScenarios,
  newScenario,
  newInstructionStep,
  newCollectStep,
  fieldLabel,
  COLLECT_FIELD_LABELS,
  SCENARIO_SUGGESTIONS,
  type StructuredScenario,
  type ScenarioStep,
  type ScenarioAction,
  type CollectFieldKey,
} from "@/lib/scenarios";

export const Route = createFileRoute("/dashboard/knowledge")({
  head: () => ({
    meta: [
      { title: "Knowledge & Facts — Ask Janice" },
      { name: "description", content: "Manage what your AI receptionist knows." },
    ],
  }),
  component: KnowledgePage,
});

interface Agent {
  id: string;
  business_name: string;
  assistant_name: string | null;
  tone: string | null;
  primary_goal: string | null;
  services: string | null;
  booking_link: string | null;
  emergency_number: string | null;
  faqs_structured: unknown;
  scenarios: unknown;
  sms_followup_enabled: boolean;
  pricing_notes: string | null;
  escalation_triggers: string | null;
  elevenlabs_agent_id: string | null;
}

type View =
  | "index"
  | "faqs"
  | "scenarios"
  | "scenario-detail"
  | "services"
  | "pricing"
  | "booking"
  | "escalation";


function KnowledgePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const syncEl = useServerFn(syncReceptionistAgent);
  const suggestFaqsFn = useServerFn(suggestFaqs);

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<View>("index");
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [openScenarioId, setOpenScenarioId] = useState<string | null>(null);
  const [dragStepIdx, setDragStepIdx] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedFaq[] | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsHasCallData, setSuggestionsHasCallData] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState({
    business_name: "",
    assistant_name: "",
    tone: "",
    primary_goal: "",
    services: "",
    booking_link: "",
    emergency_number: "",
    faqs_structured: [] as StructuredFaq[],
    scenarios: [] as StructuredScenario[],
    sms_followup_enabled: false,
    pricing_notes: "",
    escalation_triggers: "",
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("agents")
        .select(
          "id, business_name, assistant_name, tone, primary_goal, services, booking_link, emergency_number, faqs_structured, scenarios, sms_followup_enabled, pricing_notes, escalation_triggers, elevenlabs_agent_id"
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("load agent failed", error);
        setLoading(false);
        return;
      }
      if (!data) {
        navigate({ to: "/dashboard/onboarding", replace: true });
        return;
      }
      const a = data as Agent;
      setAgent(a);
      setEdit({
        business_name: a.business_name,
        assistant_name: a.assistant_name ?? "",
        tone: a.tone ?? "",
        primary_goal: a.primary_goal ?? "",
        services: a.services ?? "",
        booking_link: a.booking_link ?? "",
        emergency_number: a.emergency_number ?? "",
        faqs_structured: coerceFaqs(a.faqs_structured),
        scenarios: coerceScenarios(a.scenarios),
        sms_followup_enabled: a.sms_followup_enabled,
        pricing_notes: a.pricing_notes ?? "",
        escalation_triggers: a.escalation_triggers ?? "",
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, navigate]);

  // Clicking the Knowledge sidebar item while inside a drilldown resets to the index view.
  useEffect(() => {
    const onReset = () => {
      setView("index");
      setExpandedFaqId(null);
      setEditingFaqId(null);
      setOpenScenarioId(null);
    };
    window.addEventListener("reset-knowledge-view", onReset);
    return () => window.removeEventListener("reset-knowledge-view", onReset);
  }, []);

  const assistantName = agent?.assistant_name?.trim() || "your receptionist";

  const handleSave = async () => {
    if (!user || !agent) return;
    if (!edit.business_name.trim()) {
      toast.error("Business name is required");
      return;
    }
    setSaving(true);

    const cleanFaqs = edit.faqs_structured
      .map((f) => ({
        id: f.id,
        question: f.question.trim(),
        answer: f.answer.trim(),
        sms_followup: f.sms_followup,
      }))
      .filter((f) => f.question || f.answer);

    const payload = {
      business_name: edit.business_name.trim(),
      assistant_name: edit.assistant_name.trim() || null,
      tone: edit.tone.trim() || null,
      primary_goal: edit.primary_goal.trim() || null,
      services: edit.services.trim() || null,
      booking_link: edit.booking_link.trim() || null,
      emergency_number: edit.emergency_number.trim() || null,
      faqs: null,
      faqs_structured: cleanFaqs,
      scenarios: edit.scenarios,
      sms_followup_enabled: edit.sms_followup_enabled,
      pricing_notes: edit.pricing_notes.trim() || null,
      escalation_triggers: edit.escalation_triggers.trim() || null,
    };

    const { error } = await supabase
      .from("agents")
      .update(payload as never)
      .eq("id", agent.id);
    if (error) {
      setSaving(false);
      toast.error("Couldn't save changes", { description: error.message });
      return;
    }

    let elAgentId = agent.elevenlabs_agent_id;
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (token) {
        const r = await syncEl({ data: { accessToken: token, agentId: agent.id } });
        if (r.success) {
          elAgentId = r.elevenlabs_agent_id;
        } else {
          console.error("EL sync failed:", r.error);
          toast.warning("Saved, but voice agent didn't sync", { description: r.error });
        }
      }
    } catch (e) {
      console.error("EL sync exception:", e);
    }

    setAgent({ ...agent, ...payload, elevenlabs_agent_id: elAgentId });
    setSaving(false);
    toast.success("Knowledge & facts updated");
  };

  const loadSuggestions = async (opts?: { silent?: boolean }) => {
    if (!agent) return;
    setSuggestionsLoading(true);
    try {
      const r = await suggestFaqsFn({ data: { agentId: agent.id } });
      if (r.success) {
        setSuggestions(r.suggestions);
        setSuggestionsHasCallData(r.hasCallData);
      } else if (!opts?.silent) {
        toast.error("Couldn't load recommendations", { description: r.error });
      }
    } catch (e) {
      if (!opts?.silent) {
        toast.error("Couldn't load recommendations", {
          description: e instanceof Error ? e.message : "Unknown error",
        });
      }
    } finally {
      setSuggestionsLoading(false);
    }
  };

  useEffect(() => {
    if (view === "faqs" && agent && suggestions === null && !suggestionsLoading) {
      loadSuggestions({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, agent?.id]);

  const addSuggestion = async (s: SuggestedFaq) => {
    const f: StructuredFaq = {
      id: crypto.randomUUID(),
      question: s.question,
      answer: s.answer,
      sms_followup: undefined,
    };
    const nextFaqs = [f, ...edit.faqs_structured];
    setEdit((p) => ({ ...p, faqs_structured: nextFaqs }));
    setSuggestions((prev) => (prev ? prev.filter((x) => x.question !== s.question) : prev));
    // Persist immediately so it survives navigation.
    if (!agent) return;
    const cleanFaqs = nextFaqs
      .map((x) => ({
        id: x.id,
        question: x.question.trim(),
        answer: x.answer.trim(),
        sms_followup: x.sms_followup,
      }))
      .filter((x) => x.question || x.answer);
    const { error } = await supabase
      .from("agents")
      .update({ faqs_structured: cleanFaqs, faqs: null } as never)
      .eq("id", agent.id);
    if (error) {
      toast.error("Couldn't save FAQ", { description: error.message });
    } else {
      toast.success("Added to your FAQs");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No receptionist found. Set one up in onboarding.
      </div>
    );
  }

  const faqCount = edit.faqs_structured.length;

  const saveButton = (
    <div className="flex items-center justify-end pt-4">
      <Button
        disabled={saving}
        className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white"
        onClick={handleSave}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );

  // ---------- FAQ drilldown ----------
  if (view === "faqs") {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => {
                setView("index");
                setEditingFaqId(null);
                setExpandedFaqId(null);
              }}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition mb-2"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Knowledge
            </button>
            <h1 className="font-display text-2xl font-bold text-foreground">FAQs</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Questions {assistantName} can answer directly.
            </p>
          </div>
          <Button
            type="button"
            className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
            onClick={() => {
              const f = newFaq();
              setEdit((p) => ({ ...p, faqs_structured: [f, ...p.faqs_structured] }));
              setExpandedFaqId(f.id);
              setEditingFaqId(f.id);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> New FAQ
          </Button>
        </div>

        <section className="rounded-lg border border-border p-4 mb-6 bg-muted/30">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="text-sm">SMS follow-up by default</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {assistantName} can offer to text callers an FAQ answer for their reference.
              </p>
            </div>
            <Switch
              checked={edit.sms_followup_enabled}
              onCheckedChange={(v) => setEdit({ ...edit, sms_followup_enabled: v })}
            />
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Suggestions (left) */}
          <section className="min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <h2 className="text-sm font-semibold text-foreground">Suggestions for you</h2>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ml-auto shrink-0 text-xs h-7"
                disabled={suggestionsLoading}
                onClick={() => {
                  setDismissedSuggestions(new Set());
                  setSuggestions(null);
                  loadSuggestions();
                }}
              >
                {suggestionsLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Refresh"
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Based on your business info{suggestionsHasCallData ? " and recent calls" : ""}. Tap Add to include one.
            </p>
        {(() => {

          const visible = (suggestions ?? []).filter(
            (s) => !dismissedSuggestions.has(s.question),
          );
          return (
            <div>

              {suggestionsLoading && !suggestions ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Thinking of good questions to ask…
                </p>
              ) : visible.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No new suggestions right now. Add some FAQs or take a few calls, then Refresh.
                </p>
              ) : (
                <div className="space-y-2">
                  {visible.map((s) => (
                    <div
                      key={s.question}
                      className="rounded-md border border-border bg-card p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground">{s.question}</p>
                            <span
                              className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${s.source === "calls" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                            >
                              {s.source === "calls" ? "From calls" : "From your info"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                            {s.answer}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 px-2 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                            onClick={() => addSuggestion(s)}
                          >
                            <Plus className="h-3 w-3 mr-1" /> Add
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-muted-foreground"
                            onClick={() =>
                              setDismissedSuggestions((prev) => {
                                const next = new Set(prev);
                                next.add(s.question);
                                return next;
                              })
                            }
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
          </section>

          {/* All FAQs (right) */}
          <section className="min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-foreground">All FAQs</h2>
              <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                {faqCount}
              </span>
            </div>
        {faqCount === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center border border-dashed border-border rounded-lg">
            No FAQs yet. Click "New FAQ" to create one.
          </p>
        ) : (

          <div className="space-y-2">
            {edit.faqs_structured.map((faq, idx) => {
              const isOpen = expandedFaqId === faq.id;
              const isEditing = editingFaqId === faq.id;
              const smsOn = faq.sms_followup ?? edit.sms_followup_enabled;
              const updateFaq = (patch: Partial<StructuredFaq>) => {
                const next = [...edit.faqs_structured];
                next[idx] = { ...faq, ...patch };
                setEdit({ ...edit, faqs_structured: next });
              };
              return (
                <div
                  key={faq.id}
                  className="rounded-lg border border-border bg-card overflow-hidden transition-shadow hover:shadow-sm"
                >
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                    onClick={() => {
                      if (isEditing) return;
                      setExpandedFaqId(isOpen ? null : faq.id);
                    }}
                  >
                    <span className="text-sm font-medium text-foreground truncate">
                      {faq.question.trim() || (
                        <span className="text-muted-foreground italic">Untitled question</span>
                      )}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-0 border-t border-border/60 space-y-3">
                      {isEditing ? (
                        <>
                          <div>
                            <Label className="text-xs text-muted-foreground">Question</Label>
                            <Input
                              autoFocus
                              placeholder="What are your hours?"
                              value={faq.question}
                              onChange={(e) => updateFaq({ question: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Answer</Label>
                            <Textarea
                              placeholder="Answer"
                              value={faq.answer}
                              rows={3}
                              onChange={(e) => updateFaq({ answer: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                          <button
                            type="button"
                            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition"
                            onClick={() => {
                              const cur = faq.sms_followup;
                              const newVal =
                                cur === undefined ? true : cur === true ? false : undefined;
                              updateFaq({ sms_followup: newVal });
                            }}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            SMS follow-up:{" "}
                            <span
                              className={`font-medium ${smsOn ? "text-emerald-600" : "text-muted-foreground"}`}
                            >
                              {faq.sms_followup === undefined
                                ? `default (${edit.sms_followup_enabled ? "on" : "off"})`
                                : faq.sms_followup
                                  ? "always on"
                                  : "always off"}
                            </span>
                          </button>
                          <div className="flex items-center justify-between pt-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                const next = edit.faqs_structured.filter((_, i) => i !== idx);
                                setEdit({ ...edit, faqs_structured: next });
                                setEditingFaqId(null);
                                setExpandedFaqId(null);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={saving}
                              onClick={async () => {
                                setEditingFaqId(null);
                                await handleSave();
                              }}
                            >
                              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                              Done
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                            {faq.answer.trim() || (
                              <span className="text-muted-foreground italic">No answer yet.</span>
                            )}
                          </p>
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <MessageSquare className="h-3 w-3" />
                              SMS follow-up:{" "}
                              <span className={smsOn ? "text-emerald-600 font-medium" : ""}>
                                {faq.sms_followup === undefined
                                  ? `default (${edit.sms_followup_enabled ? "on" : "off"})`
                                  : faq.sms_followup
                                    ? "always on"
                                    : "always off"}
                              </span>
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 text-primary hover:text-primary"
                              onClick={() => setEditingFaqId(faq.id)}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
          </section>
        </div>


      </div>

    );
  }

  // ---------- Scenarios list ----------
  const scenarios = edit.scenarios;
  const activeScenarioCount = scenarios.filter((s) => s.intent.trim()).length;
  const openScenario = scenarios.find((s) => s.id === openScenarioId) ?? null;
  const openScenarioIdx = openScenario
    ? scenarios.findIndex((s) => s.id === openScenarioId)
    : -1;

  const updateScenario = (idx: number, patch: Partial<StructuredScenario>) => {
    const next = [...scenarios];
    next[idx] = { ...next[idx], ...patch };
    setEdit({ ...edit, scenarios: next });
  };

  const addScenario = (intent = "") => {
    const s = newScenario(intent);
    setEdit({ ...edit, scenarios: [s, ...scenarios] });
    setOpenScenarioId(s.id);
    setView("scenario-detail");
  };

  if (view === "scenarios") {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => setView("index")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition mb-2"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Knowledge
            </button>
            <h1 className="font-display text-2xl font-bold text-foreground">Scenario builder</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Script exactly how {assistantName} should handle specific customer requests.
            </p>
          </div>
          <Button
            type="button"
            className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
            onClick={() => addScenario()}
          >
            <Plus className="h-4 w-4 mr-1" /> New scenario
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Suggestions */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3">Suggestions for you</h2>
            <div className="space-y-2">
              {SCENARIO_SUGGESTIONS.filter(
                (sug) =>
                  !scenarios.some(
                    (s) => s.intent.trim().toLowerCase() === sug.toLowerCase(),
                  ),
              ).map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => addScenario(sug)}
                  className="w-full flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left hover:border-primary/50 hover:shadow-sm transition"
                >
                  <span className="text-sm text-foreground">{sug}</span>
                  <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
              {SCENARIO_SUGGESTIONS.every((sug) =>
                scenarios.some(
                  (s) => s.intent.trim().toLowerCase() === sug.toLowerCase(),
                ),
              ) && (
                <p className="text-xs text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">
                  You've added all suggested scenarios.
                </p>
              )}
            </div>
          </section>

          {/* All scenarios */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-foreground">All scenarios</h2>
              <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                {activeScenarioCount} active
              </span>
            </div>
            {scenarios.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center border border-dashed border-border rounded-lg">
                No scenarios yet. Add a suggestion on the left or click "New scenario".
              </p>
            ) : (
              <div className="space-y-2">
                {scenarios.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setOpenScenarioId(s.id);
                      setView("scenario-detail");
                    }}
                    className="w-full flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left hover:border-primary/50 hover:shadow-sm transition"
                  >
                    <div className="min-w-0 flex items-start gap-3">
                      <div className="h-8 w-8 rounded-md bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                        <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          If customer wants to:
                        </div>
                        <div className="text-sm font-medium text-foreground truncate">
                          {s.intent.trim() || (
                            <span className="text-muted-foreground italic">Untitled scenario</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {saveButton}
      </div>
    );
  }

  // ---------- Scenario detail ----------
  if (view === "scenario-detail" && openScenario && openScenarioIdx >= 0) {
    const s = openScenario;
    const idx = openScenarioIdx;

    const updateStep = (stepIdx: number, patch: Partial<ScenarioStep>) => {
      const nextSteps = [...s.steps];
      nextSteps[stepIdx] = { ...nextSteps[stepIdx], ...patch } as ScenarioStep;
      updateScenario(idx, { steps: nextSteps });
    };
    const removeStep = (stepIdx: number) => {
      updateScenario(idx, { steps: s.steps.filter((_, i) => i !== stepIdx) });
    };
    const moveStep = (from: number, to: number) => {
      if (from === to || to < 0 || to >= s.steps.length) return;
      const next = [...s.steps];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      updateScenario(idx, { steps: next });
    };
    const setAction = (a: ScenarioAction) => updateScenario(idx, { action: a });

    const collectStepIdx = s.steps.findIndex((st) => st.kind === "collect_info");
    const hasCollect = collectStepIdx >= 0;

    return (
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              setView("scenarios");
              setOpenScenarioId(null);
            }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="h-4 w-4" /> All scenarios
          </button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => {
              setEdit({
                ...edit,
                scenarios: scenarios.filter((_, i) => i !== idx),
              });
              setOpenScenarioId(null);
              setView("scenarios");
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete scenario
          </Button>
        </div>

        <div className="space-y-8">
          {/* 1. Customer intent */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-md bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                1
              </span>
              <h2 className="text-base font-semibold text-foreground">Customer intent</h2>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                If customer wants to:
              </Label>
              <Textarea
                value={s.intent}
                onChange={(e) => updateScenario(idx, { intent: e.target.value })}
                placeholder="e.g. request a quote for a bathroom renovation"
                rows={2}
                className="mt-2 border-0 shadow-none focus-visible:ring-0 px-2 py-1 resize-none"
              />
            </div>
          </section>

          {/* 2. Steps */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-md bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                  2
                </span>
                <h2 className="text-base font-semibold text-foreground">Steps</h2>
              </div>
              <div className="flex items-center gap-2">
                {!hasCollect && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      updateScenario(idx, { steps: [...s.steps, newCollectStep()] })
                    }
                  >
                    Add collect info
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() =>
                    updateScenario(idx, { steps: [...s.steps, newInstructionStep()] })
                  }
                >
                  Add step
                </Button>
              </div>
            </div>

            {s.steps.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-lg">
                Add a step to tell {assistantName} what to say or ask.
              </p>
            ) : (
              <div className="space-y-3">
                {s.steps.map((step, stepIdx) => (
                  <div
                    key={step.id}
                    onDragOver={(e) => {
                      if (dragStepIdx !== null) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragStepIdx !== null) moveStep(dragStepIdx, stepIdx);
                      setDragStepIdx(null);
                    }}
                    className={`rounded-lg border border-border bg-card p-4 transition ${
                      dragStepIdx === stepIdx ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        draggable
                        onDragStart={() => setDragStepIdx(stepIdx)}
                        onDragEnd={() => setDragStepIdx(null)}
                        className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-muted-foreground mt-1 shrink-0"
                        aria-label="Drag to reorder"
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                      <div className="flex-1 min-w-0">
                        {step.kind === "instruction" ? (
                          <>
                            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Then:
                            </Label>
                            <Textarea
                              value={step.text}
                              onChange={(e) => updateStep(stepIdx, { text: e.target.value })}
                              placeholder='e.g. "Ask what city they are located in"'
                              rows={3}
                              className="mt-2 border-0 shadow-none focus-visible:ring-0 px-2 py-1 resize-none"
                            />
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <Label className="text-sm font-semibold text-foreground">
                                Collect customer info
                              </Label>
                              <span className="text-[10px] rounded bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 font-medium">
                                {step.fields.length} selected
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(Object.keys(COLLECT_FIELD_LABELS) as CollectFieldKey[]).map(
                                (key) => {
                                  const selected = step.fields.includes(key);
                                  return (
                                    <button
                                      key={key}
                                      type="button"
                                      onClick={() => {
                                        const nextFields = selected
                                          ? step.fields.filter((f) => f !== key)
                                          : [...step.fields, key];
                                        updateStep(stepIdx, { fields: nextFields });
                                      }}
                                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition ${
                                        selected
                                          ? "border-primary bg-primary/10 text-primary"
                                          : "border-border text-muted-foreground hover:border-primary/50"
                                      }`}
                                    >
                                      {selected && <Check className="h-3 w-3" />}
                                      {fieldLabel(key)}
                                    </button>
                                  );
                                },
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStep(stepIdx)}
                        className="text-muted-foreground hover:text-destructive transition shrink-0"
                        aria-label="Remove step"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 3. Select action */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-md bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                3
              </span>
              <h2 className="text-base font-semibold text-foreground">
                Select action{" "}
                <span className="text-muted-foreground font-normal text-sm">(optional)</span>
              </h2>
            </div>

            {s.action === null ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setAction({ type: "call_transfer", phone: "" })}
                  className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition flex items-center justify-center gap-2 text-sm text-foreground"
                >
                  <Phone className="h-4 w-4" /> Call Transfer
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAction({
                      type: "post_call_sms",
                      message: "",
                    })
                  }
                  className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition flex items-center justify-center gap-2 text-sm text-foreground"
                >
                  <MessageSquare className="h-4 w-4" /> Post call SMS
                </button>
                <button
                  type="button"
                  onClick={() => setAction({ type: "schedule_appointment" })}
                  className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition flex items-center justify-center gap-2 text-sm text-foreground"
                >
                  <Calendar className="h-4 w-4" /> Schedule appointment
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    {s.action.type === "call_transfer" && (
                      <>
                        <Phone className="h-4 w-4" /> Call Transfer
                      </>
                    )}
                    {s.action.type === "post_call_sms" && (
                      <>
                        <MessageSquare className="h-4 w-4" /> Post call SMS
                      </>
                    )}
                    {s.action.type === "schedule_appointment" && (
                      <>
                        <Calendar className="h-4 w-4" /> Schedule appointment
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-destructive transition"
                    onClick={() => setAction(null)}
                  >
                    Remove
                  </button>
                </div>
                {s.action.type === "call_transfer" && (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Phone number to transfer to
                      </Label>
                      <Input
                        value={s.action.phone}
                        onChange={(e) =>
                          setAction({
                            type: "call_transfer",
                            phone: e.target.value,
                            voicemailFallback:
                              s.action?.type === "call_transfer"
                                ? s.action.voicemailFallback === true
                                : false,
                          })
                        }
                        placeholder="+1 555 123 4567"
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 bg-muted/30 p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          If they don't pick up, send caller to their voicemail
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {s.action.voicemailFallback
                            ? `Caller hears ringing, then is dropped into the voicemail at ${s.action.phone || "that number"} on no-answer — ${assistantName} won't take a message.`
                            : `${assistantName} will take a message instead of routing the caller to voicemail.`}
                        </p>
                      </div>
                      <Switch
                        checked={s.action.voicemailFallback === true}
                        onCheckedChange={(checked) =>
                          setAction({
                            type: "call_transfer",
                            phone:
                              s.action?.type === "call_transfer" ? s.action.phone : "",
                            voicemailFallback: checked,
                          })
                        }
                      />
                    </div>
                  </div>
                )}
                {s.action.type === "post_call_sms" && (
                  <div>
                    <Label className="text-xs text-muted-foreground">SMS message</Label>
                    <Textarea
                      value={s.action.message}
                      onChange={(e) =>
                        setAction({ type: "post_call_sms", message: e.target.value })
                      }
                      placeholder="Hi there! Thanks for calling — here's the link we talked about: …"
                      rows={4}
                      className="mt-1"
                    />
                  </div>
                )}
                {s.action.type === "schedule_appointment" && (
                  <p className="text-xs text-muted-foreground">
                    {assistantName} will use your connected calendar to find times and book the
                    appointment.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

        {saveButton}
      </div>
    );
  }

  // ---------- Simple field drilldowns ----------
  const simpleViews: Record<
    "services" | "pricing" | "booking" | "escalation",
    { title: string; helper: string; body: React.ReactNode }
  > = {
    services: {
      title: "Services",
      helper: `List the services your business offers so ${assistantName} can answer questions about them.`,
      body: (
        <Textarea
          id="services"
          value={edit.services}
          onChange={(e) => setEdit({ ...edit, services: e.target.value })}
          rows={10}
          placeholder="One service per line"
        />
      ),
    },
    pricing: {
      title: "Pricing",
      helper: `Short pricing notes ${assistantName} can reference when callers ask.`,
      body: (
        <Textarea
          id="pricing_notes"
          value={edit.pricing_notes}
          onChange={(e) => setEdit({ ...edit, pricing_notes: e.target.value })}
          rows={6}
          placeholder="e.g. Honey ranges from $4.00 to $84.00…"
        />
      ),
    },
    booking: {
      title: "Booking & Contact",
      helper: "Where callers can book, and a number to reach a human in emergencies.",
      body: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="booking_link">Booking link</Label>
            <Input
              id="booking_link"
              value={edit.booking_link}
              onChange={(e) => setEdit({ ...edit, booking_link: e.target.value })}
              className="mt-1"
              placeholder="https://…"
            />
          </div>
          <div>
            <Label htmlFor="emergency_number">Emergency number</Label>
            <Input
              id="emergency_number"
              value={edit.emergency_number}
              onChange={(e) => setEdit({ ...edit, emergency_number: e.target.value })}
              className="mt-1"
              placeholder="(555) 555-5555"
            />
          </div>
        </div>
      ),
    },
    escalation: {
      title: "Escalation triggers",
      helper: `Situations where ${assistantName} should stop and escalate to a human.`,
      body: (
        <Textarea
          id="escalation_triggers"
          value={edit.escalation_triggers}
          onChange={(e) => setEdit({ ...edit, escalation_triggers: e.target.value })}
          rows={8}
          placeholder="One trigger per line"
        />
      ),
    },
  };

  if (view === "services" || view === "pricing" || view === "booking" || view === "escalation") {
    const v = simpleViews[view];
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-8">
        <button
          type="button"
          onClick={() => setView("index")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition mb-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Knowledge
        </button>
        <h1 className="font-display text-2xl font-bold text-foreground">{v.title}</h1>
        <p className="text-muted-foreground text-sm mt-1 mb-6">{v.helper}</p>
        {v.body}
        {saveButton}
      </div>
    );
  }

  // ---------- Index ----------

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Knowledge & Facts</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Edit what {assistantName} knows about your business.
        </p>
      </div>

      <section className="mb-8">
        <div className="mb-2">
          <h2 className="text-sm font-semibold text-foreground">Context</h2>
          <p className="text-xs text-muted-foreground">
            Enhance {assistantName}'s reliability by providing key context.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setView("faqs")}
            className="group rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-sm transition p-4 text-left flex items-center justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                <HelpCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">FAQ</div>
                <div className="mt-1 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {faqCount} {faqCount === 1 ? "FAQ" : "FAQs"}
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => setView("scenarios")}
            className="group rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-sm transition p-4 text-left flex items-center justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Scenario</div>
                <div className="mt-1 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {activeScenarioCount} {activeScenarioCount === 1 ? "scenario" : "scenarios"}
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
          </button>

          {(() => {
            const servicesCount = edit.services
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean).length;
            const pricingSet = edit.pricing_notes.trim().length > 0;
            const bookingFilled =
              (edit.booking_link.trim() ? 1 : 0) + (edit.emergency_number.trim() ? 1 : 0);
            const escalationCount = edit.escalation_triggers
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean).length;
            const cards: Array<{
              key: View;
              title: string;
              icon: React.ReactNode;
              iconWrap: string;
              chip: string;
            }> = [
              {
                key: "services",
                title: "Services",
                iconWrap: "bg-amber-50 dark:bg-amber-950/40",
                icon: <Briefcase className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
                chip: servicesCount ? `${servicesCount} items` : "Empty",
              },
              {
                key: "pricing",
                title: "Pricing",
                iconWrap: "bg-green-50 dark:bg-green-950/40",
                icon: <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />,
                chip: pricingSet ? "Set" : "Not set",
              },
              {
                key: "booking",
                title: "Booking & Contact",
                iconWrap: "bg-sky-50 dark:bg-sky-950/40",
                icon: <Calendar className="h-5 w-5 text-sky-600 dark:text-sky-400" />,
                chip: bookingFilled === 0 ? "Not set" : `${bookingFilled} of 2`,
              },
              {
                key: "escalation",
                title: "Escalation triggers",
                iconWrap: "bg-rose-50 dark:bg-rose-950/40",
                icon: <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />,
                chip: escalationCount ? `${escalationCount} triggers` : "Empty",
              },
            ];
            return cards.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setView(c.key)}
                className="group rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-sm transition p-4 text-left flex items-center justify-between"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${c.iconWrap}`}
                  >
                    {c.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{c.title}</div>
                    <div className="mt-1 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {c.chip}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
              </button>
            ));
          })()}
        </div>
      </section>
    </div>
  );
}

