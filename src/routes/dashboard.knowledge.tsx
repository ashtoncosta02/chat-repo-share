import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
} from "lucide-react";
import { syncReceptionistAgent } from "@/lib/elevenlabs-agent.functions";
import { coerceFaqs, newFaq, type StructuredFaq } from "@/lib/faqs";

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
  sms_followup_enabled: boolean;
  pricing_notes: string | null;
  escalation_triggers: string | null;
  elevenlabs_agent_id: string | null;
}

type View = "index" | "faqs" | "scenarios";

function KnowledgePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const syncEl = useServerFn(syncReceptionistAgent);

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<View>("index");
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [edit, setEdit] = useState({
    business_name: "",
    assistant_name: "",
    tone: "",
    primary_goal: "",
    services: "",
    booking_link: "",
    emergency_number: "",
    faqs_structured: [] as StructuredFaq[],
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
          "id, business_name, assistant_name, tone, primary_goal, services, booking_link, emergency_number, faqs_structured, sms_followup_enabled, pricing_notes, escalation_triggers, elevenlabs_agent_id"
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
      sms_followup_enabled: edit.sms_followup_enabled,
      pricing_notes: edit.pricing_notes.trim() || null,
      escalation_triggers: edit.escalation_triggers.trim() || null,
    };

    const { error } = await supabase.from("agents").update(payload).eq("id", agent.id);
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
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-8">
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
                              onClick={() => setEditingFaqId(null)}
                            >
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
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 text-primary hover:text-primary"
                                onClick={() => setEditingFaqId(faq.id)}
                              >
                                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  const next = edit.faqs_structured.filter((_, i) => i !== idx);
                                  setEdit({ ...edit, faqs_structured: next });
                                }}
                                aria-label="Delete FAQ"
                              >
                                <XIcon className="h-4 w-4" />
                              </Button>
                            </div>
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

        {saveButton}
      </div>
    );
  }

  // ---------- Scenario drilldown ----------
  if (view === "scenarios") {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => setView("index")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition mb-2"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Knowledge
            </button>
            <h1 className="font-display text-2xl font-bold text-foreground">Scenarios</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Custom situations {assistantName} should handle a specific way.
            </p>
          </div>
          <Button
            type="button"
            disabled
            className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
          >
            <Plus className="h-4 w-4 mr-1" /> New Scenario
          </Button>
        </div>

        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <Layers className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Scenarios are coming soon</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            You'll be able to script custom situations — like after-hours callers, price shoppers,
            or emergencies — and tell {assistantName} exactly how to respond.
          </p>
        </div>
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
                  Coming soon
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
          </button>
        </div>
      </section>

      <div className="space-y-6">
        <section className="space-y-4">
          <div>
            <Label htmlFor="business_name">Business name</Label>
            <Input
              id="business_name"
              value={edit.business_name}
              onChange={(e) => setEdit({ ...edit, business_name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="assistant_name">Receptionist name</Label>
            <Input
              id="assistant_name"
              value={edit.assistant_name}
              onChange={(e) => setEdit({ ...edit, assistant_name: e.target.value })}
              placeholder="Janice"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tone">Tone</Label>
              <Input
                id="tone"
                value={edit.tone}
                onChange={(e) => setEdit({ ...edit, tone: e.target.value })}
                placeholder="Friendly, professional"
              />
            </div>
            <div>
              <Label htmlFor="primary_goal">Primary goal</Label>
              <Input
                id="primary_goal"
                value={edit.primary_goal}
                onChange={(e) => setEdit({ ...edit, primary_goal: e.target.value })}
              />
            </div>
          </div>
        </section>

        <section>
          <Label htmlFor="services">Services</Label>
          <Textarea
            id="services"
            value={edit.services}
            onChange={(e) => setEdit({ ...edit, services: e.target.value })}
            rows={4}
            placeholder="List the services your business offers so your receptionist can answer questions about them."
          />
        </section>

        <section>
          <Label htmlFor="pricing_notes">Pricing notes</Label>
          <Textarea
            id="pricing_notes"
            value={edit.pricing_notes}
            onChange={(e) => setEdit({ ...edit, pricing_notes: e.target.value })}
            rows={2}
          />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="booking_link">Booking link</Label>
            <Input
              id="booking_link"
              value={edit.booking_link}
              onChange={(e) => setEdit({ ...edit, booking_link: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="emergency_number">Emergency number</Label>
            <Input
              id="emergency_number"
              value={edit.emergency_number}
              onChange={(e) => setEdit({ ...edit, emergency_number: e.target.value })}
            />
          </div>
        </section>

        <section>
          <Label htmlFor="escalation_triggers">Escalation triggers</Label>
          <Textarea
            id="escalation_triggers"
            value={edit.escalation_triggers}
            onChange={(e) => setEdit({ ...edit, escalation_triggers: e.target.value })}
            rows={2}
          />
        </section>

        {saveButton}
      </div>
    </div>
  );
}
