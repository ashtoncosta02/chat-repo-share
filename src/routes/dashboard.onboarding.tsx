import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { scrapeBusinessFromUrl } from "@/lib/agent-functions";
import { syncReceptionistAgent } from "@/lib/elevenlabs-agent.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Sparkles, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_VOICE_ID } from "@/lib/voices";
import { AgentFactoryLogo } from "@/components/AgentFactoryLogo";
import { VoicePickerCard } from "@/components/dashboard/VoicePickerCard";
import { GreetingFarewellCard } from "@/components/dashboard/GreetingFarewellCard";
import { PhoneNumberSetup } from "@/components/dashboard/PhoneNumberSetup";
import { AnswerModeCard } from "@/components/dashboard/AnswerModeCard";

export const Route = createFileRoute("/dashboard/onboarding")({
  head: () => ({ meta: [{ title: "Set up your AI Receptionist — Ask Janice" }] }),
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

interface AgentState {
  id: string;
  voice_id: string | null;
  greeting_message: string | null;
  farewell_message: string | null;
  answer_mode: "immediate" | "after_4_rings";
  owner_forward_phone: string | null;
}

function OnboardingWizard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const scrape = useServerFn(scrapeBusinessFromUrl);
  const syncEl = useServerFn(syncReceptionistAgent);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [checkingExisting, setCheckingExisting] = useState(true);

  // Step 1
  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [profile, setProfile] = useState<ProfileDraft>(emptyProfile);
  const [scraped, setScraped] = useState(false);
  const [savingStep1, setSavingStep1] = useState(false);

  // Persisted agent after step 1
  const [agent, setAgent] = useState<AgentState | null>(null);

  const [finishing, setFinishing] = useState(false);

  // Redirect to dashboard if user already has a receptionist; resume in-flight setup otherwise
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    supabase
      .from("agents")
      .select(
        "id, business_name, assistant_name, industry, tone, primary_goal, services, booking_link, emergency_number, pricing_notes, escalation_triggers, source_url, voice_id, greeting_message, farewell_message, answer_mode, owner_forward_phone, onboarding_completed",
      )
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.onboarding_completed) {
          navigate({ to: "/dashboard" });
          return;
        }
        if (data) {
          // Resume mid-wizard
          setProfile({
            business_name: data.business_name ?? "",
            assistant_name: data.assistant_name ?? "",
            industry: data.industry ?? "",
            tone: data.tone ?? "",
            primary_goal: data.primary_goal ?? "",
            services: data.services ?? "",
            booking_link: data.booking_link ?? "",
            emergency_number: data.emergency_number ?? "",
            pricing_notes: data.pricing_notes ?? "",
            escalation_triggers: data.escalation_triggers ?? "",
          });
          setUrl(data.source_url ?? "");
          setAgent({
            id: data.id,
            voice_id: data.voice_id,
            greeting_message: data.greeting_message,
            farewell_message: data.farewell_message,
            answer_mode: (data.answer_mode as "immediate" | "after_4_rings") ?? "immediate",
            owner_forward_phone: data.owner_forward_phone,
          });
          setStep(2);
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
      setScraped(true);
      toast.success("Filled in from your website");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scrape failed");
    } finally {
      setScraping(false);
    }
  };

  // After Step 1: persist agent row (or update if resuming) and move to Step 2.
  const handleFinishStep1 = async () => {
    if (!user) return;
    if (!profile.business_name.trim()) {
      toast.error("Business name is required");
      return;
    }
    setSavingStep1(true);
    const assistantName = profile.assistant_name.trim() || "Janice";
    const businessName = profile.business_name.trim();
    const payload = {
      user_id: user.id,
      business_name: businessName,
      assistant_name: assistantName,
      industry: profile.industry.trim() || null,
      tone: profile.tone.trim() || null,
      primary_goal: profile.primary_goal.trim() || null,
      services: profile.services.trim() || null,
      booking_link: profile.booking_link.trim() || null,
      emergency_number: profile.emergency_number.trim() || null,
      pricing_notes: profile.pricing_notes.trim() || null,
      escalation_triggers: profile.escalation_triggers.trim() || null,
      source_url: url.trim() || null,
    };

    if (agent) {
      const { error } = await supabase.from("agents").update(payload).eq("id", agent.id);
      setSavingStep1(false);
      if (error) {
        toast.error("Couldn't save profile", { description: error.message });
        return;
      }
      setStep(2);
      return;
    }

    const { data: inserted, error } = await supabase
      .from("agents")
      .insert({
        ...payload,
        voice_id: DEFAULT_VOICE_ID,
        answer_mode: "immediate",
        onboarding_completed: false,
        is_live: true,
      })
      .select(
        "id, voice_id, greeting_message, farewell_message, answer_mode, owner_forward_phone",
      )
      .single();
    setSavingStep1(false);
    if (error || !inserted) {
      toast.error("Couldn't create your receptionist", {
        description: error?.message || "No row returned",
      });
      return;
    }
    setAgent({
      id: inserted.id,
      voice_id: inserted.voice_id,
      greeting_message: inserted.greeting_message,
      farewell_message: inserted.farewell_message,
      answer_mode: (inserted.answer_mode as "immediate" | "after_4_rings") ?? "immediate",
      owner_forward_phone: inserted.owner_forward_phone,
    });
    setStep(2);
  };

  const handleFinish = async () => {
    if (!user || !agent) return;
    setFinishing(true);
    const { error } = await supabase
      .from("agents")
      .update({ onboarding_completed: true })
      .eq("id", agent.id);
    if (error) {
      setFinishing(false);
      toast.error("Couldn't finish setup", { description: error.message });
      return;
    }
    // Provision / re-sync the live ElevenLabs voice agent. Non-fatal.
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (token) {
        const r = await syncEl({ data: { accessToken: token, agentId: agent.id } });
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
    <div className="min-h-screen bg-[oklch(0.97_0.012_290)]">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <AgentFactoryLogo />
          <div className="text-sm text-muted-foreground">Step {step} of 3</div>
        </div>
        <div className="max-w-4xl mx-auto px-6 pb-4">
          <Progress value={progressValue} className="h-1.5" />
          <div className="flex justify-between mt-2 text-xs">
            <span className={step >= 1 ? "text-foreground font-medium" : "text-muted-foreground"}>
              Website
            </span>
            <span className={step >= 2 ? "text-foreground font-medium" : "text-muted-foreground"}>
              Choose your receptionist
            </span>
            <span className={step >= 3 ? "text-foreground font-medium" : "text-muted-foreground"}>
              Phone number
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {step === 1 && (
          <StepWebsite
            url={url}
            setUrl={setUrl}
            scraping={scraping}
            scraped={scraped}
            profile={profile}
            setProfile={setProfile}
            onScrape={handleScrape}
            saving={savingStep1}
            onNext={handleFinishStep1}
          />
        )}

        {step === 2 && agent && (
          <StepReceptionist
            agent={agent}
            businessName={profile.business_name || "our office"}
            assistantName={profile.assistant_name || "Janice"}
            onVoiceChange={(voice_id) => setAgent({ ...agent, voice_id })}
            onGreetingSaved={(next) =>
              setAgent({
                ...agent,
                greeting_message: next.greeting,
                farewell_message: next.farewell,
              })
            }
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && agent && (
          <StepPhone
            agent={agent}
            onAnswerModeChange={(next) => setAgent({ ...agent, answer_mode: next })}
            onForwardPhoneChange={(next) =>
              setAgent({ ...agent, owner_forward_phone: next })
            }
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
  saving,
  onNext,
}: {
  url: string;
  setUrl: (v: string) => void;
  scraping: boolean;
  scraped: boolean;
  profile: ProfileDraft;
  setProfile: (v: ProfileDraft) => void;
  onScrape: () => void;
  saving: boolean;
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

      <div className="rounded-xl border border-[oklch(0.85_0.08_290)] bg-[oklch(0.97_0.04_290)] p-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-[var(--gold)]" />
          <h3 className="font-semibold text-foreground">Auto-fill from your website</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          We'll read your site and extract your business info, services, and hours.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center rounded-md border border-input bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring focus-within:border-ring">
            <span className="shrink-0 text-sm font-bold text-foreground mr-2 select-none">
              https://
            </span>
            <input
              type="text"
              inputMode="url"
              placeholder="yourbusiness.com"
              value={url.replace(/^https?:\/\//i, "")}
              onChange={(e) => {
                const raw = e.target.value.trim();
                const domain = raw.replace(/^https?:\/\//i, "");
                setUrl(domain ? `https://${domain}` : "");
              }}
              onBlur={(e) => {
                const domain = e.target.value.trim().replace(/^https?:\/\//i, "");
                setUrl(domain ? `https://${domain}` : "");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") onScrape();
              }}
              disabled={scraping}
              className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none disabled:opacity-50"
            />
          </div>
          <Button
            type="button"
            onClick={onScrape}
            disabled={!url.trim() || scraping}
            className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white"
          >
            {scraping ? "Scanning your site…" : scraped ? "Re-scan" : "Scan & Fill"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground/70">
          Example: yourbusiness.com or www.yourbusiness.net
        </p>
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
            <Field label="Receptionist's name" rightLabel="defaults to Janice">
              <Input
                value={profile.assistant_name}
                onChange={(e) => setProfile({ ...profile, assistant_name: e.target.value })}
                placeholder="Janice"
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
          disabled={!profile.business_name.trim() || saving}
          className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white"
        >
          {saving ? "Saving…" : "Next: Choose your receptionist"}
          {!saving && <ArrowRight className="h-4 w-4 ml-1.5" />}
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Step 2: Choose your receptionist ---------------- */

function StepReceptionist({
  agent,
  businessName,
  assistantName,
  onVoiceChange,
  onGreetingSaved,
  onBack,
  onNext,
}: {
  agent: AgentState;
  businessName: string;
  assistantName: string;
  onVoiceChange: (voiceId: string) => void;
  onGreetingSaved: (next: { greeting: string | null; farewell: string | null }) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">
          Choose your receptionist
        </h1>
        <p className="text-muted-foreground">
          Tap a face to hear their voice, then customize what they say when picking up and hanging up.
        </p>
      </div>

      <VoicePickerCard
        agentId={agent.id}
        businessName={businessName}
        currentVoiceId={agent.voice_id}
        onChange={onVoiceChange}
      />

      <GreetingFarewellCard
        agentId={agent.id}
        businessName={businessName}
        assistantName={assistantName}
        greeting={agent.greeting_message}
        farewell={agent.farewell_message}
        onSaved={onGreetingSaved}
      />

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </Button>
        <Button onClick={onNext} className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white">
          Next: Phone number <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Step 3: Phone number & call handling ---------------- */

function StepPhone({
  agent,
  onAnswerModeChange,
  onForwardPhoneChange,
  onBack,
  onFinish,
  finishing,
}: {
  agent: AgentState;
  onAnswerModeChange: (next: "immediate" | "after_4_rings") => void;
  onForwardPhoneChange: (next: string | null) => void;
  onBack: () => void;
  onFinish: () => void;
  finishing: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">
          Get a phone number
        </h1>
        <p className="text-muted-foreground">
          Pick a local number for your business, then choose how calls should be answered. You can change or add numbers later.
        </p>
      </div>

      <PhoneNumberSetup agentId={agent.id} />

      <AnswerModeCard
        agentId={agent.id}
        value={agent.answer_mode}
        forwardPhone={agent.owner_forward_phone}
        onChange={onAnswerModeChange}
        onForwardPhoneChange={onForwardPhoneChange}
      />

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
