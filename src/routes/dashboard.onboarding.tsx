import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { scrapeBusinessFromUrl } from "@/server/agent-functions";
import { speakText } from "@/server/agent-voice";
import { syncReceptionistAgent } from "@/server/elevenlabs-agent.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Play, Plus, Trash2, ArrowRight, ArrowLeft, Check, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { VOICE_OPTIONS, DEFAULT_VOICE_ID, getVoiceById } from "@/lib/voices";
import { newFaq, parseLegacyFaqs, type StructuredFaq } from "@/lib/faqs";
import { AgentFactoryLogo } from "@/components/AgentFactoryLogo";

export const Route = createFileRoute("/dashboard/onboarding")({
  head: () => ({ meta: [{ title: "Set up your AI Receptionist — Agent Factory" }] }),
  component: OnboardingWizard,
});

interface ProfileDraft {
  business_name: string;
  assistant_name: string;
  industry: string;
  tone: string;
  primary_goal: string;
  services: string;
  booking_link: string;
  emergency_number: string;
  pricing_notes: string;
  escalation_triggers: string;
}

const emptyProfile: ProfileDraft = {
  business_name: "",
  assistant_name: "",
  industry: "",
  tone: "",
  primary_goal: "",
  services: "",
  booking_link: "",
  emergency_number: "",
  pricing_notes: "",
  escalation_triggers: "",
};

function OnboardingWizard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const scrape = useServerFn(scrapeBusinessFromUrl);
  const speak = useServerFn(speakText);
  const syncEl = useServerFn(syncReceptionistAgent);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [checkingExisting, setCheckingExisting] = useState(true);

  // Step 1
  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [profile, setProfile] = useState<ProfileDraft>(emptyProfile);
  const [scraped, setScraped] = useState(false);

  // Step 2
  const [faqs, setFaqs] = useState<StructuredFaq[]>([newFaq()]);
  const [smsFollowup, setSmsFollowup] = useState(false);

  // Step 3
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);
  const [previewing, setPreviewing] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Redirect to dashboard if user already has a receptionist
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    supabase
      .from("agents")
      .select("id, onboarding_completed")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.onboarding_completed) {
          navigate({ to: "/dashboard" });
          return;
        }
        setCheckingExisting(false);
      });
  }, [user, authLoading, navigate]);

  if (authLoading || checkingExisting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const handleScrape = async () => {
    if (!url.trim()) {
      toast.error("Paste your business website URL first");
      return;
    }
    setScraping(true);
    try {
      const res = await scrape({ data: { url } });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setProfile({
        business_name: res.data.business_name,
        assistant_name: profile.assistant_name,
        industry: res.data.industry,
        tone: res.data.tone,
        primary_goal: res.data.primary_goal,
        services: res.data.services,
        booking_link: res.data.booking_link,
        emergency_number: res.data.emergency_number,
        pricing_notes: res.data.pricing_notes,
        escalation_triggers: res.data.escalation_triggers,
      });
      // Pre-fill structured FAQs from the scraped legacy text
      const parsed = parseLegacyFaqs(res.data.faqs);
      setFaqs(parsed.length > 0 ? parsed : [newFaq()]);
      setScraped(true);
      toast.success("Filled in from your website");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scrape failed");
    } finally {
      setScraping(false);
    }
  };

  const handleFinish = async () => {
    if (!user) return;
    if (!profile.business_name.trim()) {
      toast.error("Business name is required");
      setStep(1);
      return;
    }
    setFinishing(true);
    const cleanFaqs = faqs
      .filter((f) => f.question.trim() || f.answer.trim())
      .map((f) => ({
        id: f.id,
        question: f.question.trim(),
        answer: f.answer.trim(),
        sms_followup: f.sms_followup,
      }));

    const { data: inserted, error } = await supabase
      .from("agents")
      .insert({
        user_id: user.id,
        business_name: profile.business_name.trim(),
        assistant_name: profile.assistant_name.trim() || "Ava",
        industry: profile.industry.trim() || null,
        tone: profile.tone.trim() || null,
        primary_goal: profile.primary_goal.trim() || null,
        services: profile.services.trim() || null,
        booking_link: profile.booking_link.trim() || null,
        emergency_number: profile.emergency_number.trim() || null,
        pricing_notes: profile.pricing_notes.trim() || null,
        escalation_triggers: profile.escalation_triggers.trim() || null,
        source_url: url.trim() || null,
        voice_id: voiceId,
        faqs_structured: cleanFaqs,
        sms_followup_enabled: smsFollowup,
        onboarding_completed: true,
        is_live: true,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      setFinishing(false);
      toast.error("Couldn't create your receptionist", {
        description: error?.message || "No row returned",
      });
      return;
    }

    // Provision the live ElevenLabs voice agent so the test page works
    // immediately. Failure is non-fatal — user can re-sync from the
    // dashboard by saving any change.
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (token) {
        const r = await syncEl({
          data: { accessToken: token, agentId: inserted.id },
        });
        if (!r.success) console.error("EL provision failed:", r.error);
      }
    } catch (e) {
      console.error("EL provision exception:", e);
    }

    setFinishing(false);
    toast.success("Your AI Receptionist is live!");
    navigate({ to: "/dashboard" });
  };

  const progressValue = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <div className="min-h-screen bg-[oklch(0.97_0.012_85)]">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <AgentFactoryLogo />
          <div className="text-sm text-muted-foreground">Step {step} of 3</div>
        </div>
        <div className="max-w-3xl mx-auto px-6 pb-4">
          <Progress value={progressValue} className="h-1.5" />
          <div className="flex justify-between mt-2 text-xs">
            <span className={step >= 1 ? "text-foreground font-medium" : "text-muted-foreground"}>
              Website
            </span>
            <span className={step >= 2 ? "text-foreground font-medium" : "text-muted-foreground"}>
              FAQs & SMS
            </span>
            <span className={step >= 3 ? "text-foreground font-medium" : "text-muted-foreground"}>
              Voice
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {step === 1 && (
          <StepWebsite
            url={url}
            setUrl={setUrl}
            scraping={scraping}
            scraped={scraped}
            profile={profile}
            setProfile={setProfile}
            onScrape={handleScrape}
            onNext={() => {
              if (!profile.business_name.trim()) {
                toast.error("Add your business name to continue");
                return;
              }
              setStep(2);
            }}
          />
        )}

        {step === 2 && (
          <StepFaqs
            faqs={faqs}
            setFaqs={setFaqs}
            smsFollowup={smsFollowup}
            setSmsFollowup={setSmsFollowup}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <StepVoice
            voiceId={voiceId}
            setVoiceId={setVoiceId}
            previewing={previewing}
            onPreview={async () => {
              setPreviewing(true);
              try {
                const voice = getVoiceById(voiceId);
                const businessName = profile.business_name.trim() || "our office";
                const sample = `Hi, thanks for calling ${businessName}. How can I help you today?`;
                const res = await speak({ data: { text: sample, voiceId: voice.id } });
                if (!res.success) {
                  toast.error(res.error);
                  return;
                }
                const audio = new Audio(`data:audio/mpeg;base64,${res.audioBase64}`);
                await audio.play();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Preview failed");
              } finally {
                setPreviewing(false);
              }
            }}
            onBack={() => setStep(2)}
            onFinish={handleFinish}
            finishing={finishing}
          />
        )}
      </main>
    </div>
  );
}

/* ---------------- Step 1: Website ---------------- */

function StepWebsite({
  url,
  setUrl,
  scraping,
  scraped,
  profile,
  setProfile,
  onScrape,
  onNext,
}: {
  url: string;
  setUrl: (v: string) => void;
  scraping: boolean;
  scraped: boolean;
  profile: ProfileDraft;
  setProfile: (v: ProfileDraft) => void;
  onScrape: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">
          Let's build your AI Receptionist
        </h1>
        <p className="text-muted-foreground">
          Paste your business website and we'll fill in everything for you. You can edit anything before continuing.
        </p>
      </div>

      <div className="rounded-xl border border-[oklch(0.85_0.08_75)] bg-[oklch(0.97_0.04_80)] p-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-[var(--gold)]" />
          <h3 className="font-semibold text-foreground">Auto-fill from your website</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          We'll read your site and extract your business info, services, hours, and FAQs.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="url"
            placeholder="https://yourbusiness.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1"
            disabled={scraping}
          />
          <Button
            type="button"
            onClick={onScrape}
            disabled={!url.trim() || scraping}
            className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white"
          >
            {scraping ? "Scanning your site…" : scraped ? "Re-scan" : "Scan & Fill"}
          </Button>
        </div>
      </div>

      {(scraped || profile.business_name) && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Business Profile
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Business name *">
              <Input
                value={profile.business_name}
                onChange={(e) => setProfile({ ...profile, business_name: e.target.value })}
                required
              />
            </Field>
            <Field label="Receptionist's name" rightLabel="defaults to Ava">
              <Input
                value={profile.assistant_name}
                onChange={(e) => setProfile({ ...profile, assistant_name: e.target.value })}
                placeholder="Ava"
              />
            </Field>
            <Field label="Industry">
              <Input
                value={profile.industry}
                onChange={(e) => setProfile({ ...profile, industry: e.target.value })}
              />
            </Field>
            <Field label="Tone">
              <Input
                value={profile.tone}
                onChange={(e) => setProfile({ ...profile, tone: e.target.value })}
                placeholder="warm, professional"
              />
            </Field>
          </div>
          <Field label="Primary goal">
            <Textarea
              value={profile.primary_goal}
              onChange={(e) => setProfile({ ...profile, primary_goal: e.target.value })}
              rows={2}
            />
          </Field>
          <Field label="Services (one per line)">
            <Textarea
              value={profile.services}
              onChange={(e) => setProfile({ ...profile, services: e.target.value })}
              rows={3}
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Booking link">
              <Input
                value={profile.booking_link}
                onChange={(e) => setProfile({ ...profile, booking_link: e.target.value })}
              />
            </Field>
            <Field label="Emergency / handoff number">
              <Input
                value={profile.emergency_number}
                onChange={(e) => setProfile({ ...profile, emergency_number: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Pricing notes">
            <Textarea
              value={profile.pricing_notes}
              onChange={(e) => setProfile({ ...profile, pricing_notes: e.target.value })}
              rows={2}
            />
          </Field>
          <Field label="Escalation triggers (one per line)">
            <Textarea
              value={profile.escalation_triggers}
              onChange={(e) => setProfile({ ...profile, escalation_triggers: e.target.value })}
              rows={2}
            />
          </Field>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={onNext}
          disabled={!profile.business_name.trim()}
          className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white"
        >
          Next: FAQs <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Step 2: FAQs + SMS ---------------- */

function StepFaqs({
  faqs,
  setFaqs,
  smsFollowup,
  setSmsFollowup,
  onBack,
  onNext,
}: {
  faqs: StructuredFaq[];
  setFaqs: (f: StructuredFaq[]) => void;
  smsFollowup: boolean;
  setSmsFollowup: (v: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const updateFaq = (id: string, patch: Partial<StructuredFaq>) => {
    setFaqs(faqs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };
  const removeFaq = (id: string) => {
    if (faqs.length === 1) {
      setFaqs([newFaq()]);
      return;
    }
    setFaqs(faqs.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">
          Common questions & answers
        </h1>
        <p className="text-muted-foreground">
          Teach your receptionist how to answer the questions customers ask most. We pre-filled what we found on your site — edit, add, or remove anything.
        </p>
      </div>

      {/* SMS global setting */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-full bg-[oklch(0.95_0.05_75)] flex items-center justify-center shrink-0">
              <MessageSquare className="h-5 w-5 text-[var(--gold)]" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Offer to text answers</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                When a customer asks something, your AI Receptionist can also offer to text them the answer for easy reference.
              </p>
            </div>
          </div>
          <Switch checked={smsFollowup} onCheckedChange={setSmsFollowup} />
        </div>
        {smsFollowup && (
          <p className="text-xs text-muted-foreground mt-3 pl-13 ml-0">
            Default: ON for every FAQ. You can override per question below.
          </p>
        )}
      </div>

      {/* FAQ editor */}
      <div className="space-y-3">
        {faqs.map((faq, idx) => (
          <div key={faq.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Question {idx + 1}
              </Label>
              <button
                type="button"
                onClick={() => removeFaq(faq.id)}
                className="text-muted-foreground hover:text-destructive transition"
                aria-label="Remove FAQ"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <Input
              placeholder="e.g. Do you accept insurance?"
              value={faq.question}
              onChange={(e) => updateFaq(faq.id, { question: e.target.value })}
            />
            <Textarea
              placeholder="The answer your receptionist should give…"
              value={faq.answer}
              onChange={(e) => updateFaq(faq.id, { answer: e.target.value })}
              rows={2}
            />
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <div className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Offer to text this answer?</span>
              </div>
              <Select
                value={faq.sms_followup === undefined ? "default" : faq.sms_followup ? "yes" : "no"}
                onValueChange={(v) =>
                  updateFaq(faq.id, {
                    sms_followup: v === "default" ? undefined : v === "yes",
                  })
                }
              >
                <SelectTrigger className="w-44 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    Use default ({smsFollowup ? "Yes" : "No"})
                  </SelectItem>
                  <SelectItem value="yes">Yes — offer SMS</SelectItem>
                  <SelectItem value="no">No — never SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => setFaqs([...faqs, newFaq()])}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Add another question
        </Button>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </Button>
        <Button onClick={onNext} className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white">
          Next: Pick a voice <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Step 3: Voice ---------------- */

function StepVoice({
  voiceId,
  setVoiceId,
  previewing,
  onPreview,
  onBack,
  onFinish,
  finishing,
}: {
  voiceId: string;
  setVoiceId: (v: string) => void;
  previewing: boolean;
  onPreview: () => void;
  onBack: () => void;
  onFinish: () => void;
  finishing: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">
          Pick a voice
        </h1>
        <p className="text-muted-foreground">
          This is the voice your customers will hear on calls and in chat. Click any voice to preview it.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {VOICE_OPTIONS.map((v) => {
          const selected = v.id === voiceId;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setVoiceId(v.id)}
              className={`text-left rounded-xl border-2 p-4 transition ${
                selected
                  ? "border-[var(--gold)] bg-[oklch(0.97_0.04_80)]"
                  : "border-border bg-card hover:border-[var(--gold)]/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-foreground">{v.name}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{v.description}</div>
                  <div className="text-xs text-muted-foreground mt-1 capitalize">{v.gender}</div>
                </div>
                {selected && (
                  <div className="h-6 w-6 rounded-full bg-[var(--gold)] flex items-center justify-center shrink-0">
                    <Check className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between">
        <div>
          <div className="font-medium text-foreground">
            Preview: {getVoiceById(voiceId).name}
          </div>
          <div className="text-sm text-muted-foreground">
            Hear how your receptionist will sound on a call.
          </div>
        </div>
        <Button variant="outline" onClick={onPreview} disabled={previewing}>
          <Play className="h-4 w-4 mr-1.5" />
          {previewing ? "Loading…" : "Preview voice"}
        </Button>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={finishing}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </Button>
        <Button
          onClick={onFinish}
          disabled={finishing}
          className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white"
        >
          {finishing ? "Setting up…" : "Finish & go to dashboard"}
          {!finishing && <Check className="h-4 w-4 ml-1.5" />}
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Tiny helper ---------------- */

function Field({
  label,
  rightLabel,
  children,
}: {
  label: string;
  rightLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label>{label}</Label>
        {rightLabel && <span className="text-xs text-muted-foreground">{rightLabel}</span>}
      </div>
      {children}
    </div>
  );
}
