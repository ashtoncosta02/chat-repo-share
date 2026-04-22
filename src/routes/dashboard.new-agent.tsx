import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { scrapeBusinessFromUrl } from "@/server/agent-functions";
import { speakText } from "@/server/agent-voice";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Play } from "lucide-react";
import { toast } from "sonner";
import { VOICE_OPTIONS, DEFAULT_VOICE_ID, getVoiceById } from "@/lib/voices";

export const Route = createFileRoute("/dashboard/new-agent")({
  head: () => ({ meta: [{ title: "Build New Agent — Agent Factory" }] }),
  component: NewAgentPage,
});

interface AgentForm {
  business_name: string;
  assistant_name: string;
  industry: string;
  tone: string;
  primary_goal: string;
  services: string;
  booking_link: string;
  emergency_number: string;
  faqs: string;
  pricing_notes: string;
  escalation_triggers: string;
  voice_id: string;
}

const empty: AgentForm = {
  business_name: "",
  assistant_name: "",
  industry: "",
  tone: "",
  primary_goal: "",
  services: "",
  booking_link: "",
  emergency_number: "",
  faqs: "",
  pricing_notes: "",
  escalation_triggers: "",
  voice_id: DEFAULT_VOICE_ID,
};

function NewAgentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const scrape = useServerFn(scrapeBusinessFromUrl);
  const speak = useServerFn(speakText);
  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [form, setForm] = useState<AgentForm>(empty);

  const update = (k: keyof AgentForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleScrape = async () => {
    if (!url) return;
    setScraping(true);
    try {
      const res = await scrape({ data: { url } });
      if (!res.success) {
        toast.error(res.error);
      } else {
        // Preserve user-entered assistant_name + voice_id if any
        setForm((f) => ({
          ...res.data,
          assistant_name: f.assistant_name,
          voice_id: f.voice_id || DEFAULT_VOICE_ID,
        }) as AgentForm);
        toast.success("Form auto-filled from website");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scrape failed");
    } finally {
      setScraping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.business_name.trim()) {
      toast.error("Business name is required");
      return;
    }
    setSaving(true);

    // Ensure we have a fresh, valid session before insert (RLS needs auth.uid())
    const { data: sessionData } = await supabase.auth.getSession();
    const authedUser = sessionData.session?.user;
    if (!authedUser) {
      setSaving(false);
      toast.error("Your session expired. Please sign in again.");
      navigate({ to: "/auth" });
      return;
    }

    const { error } = await supabase.from("agents").insert({
      user_id: authedUser.id,
      business_name: form.business_name,
      assistant_name: form.assistant_name.trim() || "Ava",
      industry: form.industry || null,
      tone: form.tone || null,
      primary_goal: form.primary_goal || null,
      services: form.services || null,
      booking_link: form.booking_link || null,
      emergency_number: form.emergency_number || null,
      faqs: form.faqs || null,
      pricing_notes: form.pricing_notes || null,
      escalation_triggers: form.escalation_triggers || null,
      source_url: url || null,
      voice_id: form.voice_id || DEFAULT_VOICE_ID,
      is_live: true,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Agent created");
      navigate({ to: "/dashboard" });
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={
          <span>
            <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
            {" / New Agent"}
          </span>
        }
        title="Build New Agent"
      />
      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        {/* Auto-fill */}
        <div className="rounded-xl border border-[oklch(0.85_0.08_75)] bg-[oklch(0.97_0.04_80)] p-5">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-[var(--gold)]" />
            <h3 className="font-semibold text-foreground">Auto-fill from website</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Paste any business URL and we'll extract their services, hours, FAQs, and contact info automatically.
          </p>
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://clientwebsite.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={handleScrape}
              disabled={!url || scraping}
              className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white"
            >
              {scraping ? "Scraping…" : "Scrape & Fill"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Business profile */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Business Profile
            </h3>
            <Field label="Business Name *" required>
              <Input value={form.business_name} onChange={(e) => update("business_name", e.target.value)} placeholder="e.g. Sunrise Dental Clinic" required />
            </Field>
            <Field label="AI Assistant Name" rightLabel="defaults to Ava">
              <Input value={form.assistant_name} onChange={(e) => update("assistant_name", e.target.value)} placeholder="e.g. Ava" />
            </Field>
            <Field label="Industry">
              <Input value={form.industry} onChange={(e) => update("industry", e.target.value)} placeholder="e.g. Dental / Healthcare" />
            </Field>
            <Field label="Tone & Personality" rightLabel="affects voice">
              <Input value={form.tone} onChange={(e) => update("tone", e.target.value)} placeholder="e.g. warm, professional, friendly" />
            </Field>
            <Field label="Primary Goal">
              <Textarea value={form.primary_goal} onChange={(e) => update("primary_goal", e.target.value)} placeholder="e.g. Book appointments and answer questions about services" rows={2} />
            </Field>
            <Field label="Services (one per line)">
              <Textarea value={form.services} onChange={(e) => update("services", e.target.value)} placeholder="Checkups & Cleanings" rows={3} />
            </Field>
            <Field label="Escalation Triggers (one per line)">
              <Textarea value={form.escalation_triggers} onChange={(e) => update("escalation_triggers", e.target.value)} placeholder="Severe pain, billing dispute" rows={2} />
            </Field>
            <Field label="Voice" rightLabel="used for chat & phone calls">
              <div className="flex gap-2">
                <Select
                  value={form.voice_id}
                  onValueChange={(v) => update("voice_id", v)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_OPTIONS.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        <span className="font-medium">{v.name}</span>
                        <span className="text-muted-foreground"> — {v.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={previewing}
                  onClick={async () => {
                    setPreviewing(true);
                    try {
                      const voice = getVoiceById(form.voice_id);
                      const businessName = form.business_name.trim() || "our office";
                      const sample = `Hi, thanks for calling ${businessName}. How can I help you today?`;
                      const res = await speak({
                        data: { text: sample, voiceId: voice.id },
                      });
                      if (!res.success) {
                        toast.error(res.error);
                        return;
                      }
                      const audio = new Audio(`data:audio/mpeg;base64,${res.audioBase64}`);
                      await audio.play();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Preview failed");
                    } finally {
                      setPreviewing(false);
                    }
                  }}
                >
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  {previewing ? "Loading…" : "Preview"}
                </Button>
              </div>
            </Field>
          </div>

          {/* Knowledge & integration */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Knowledge & Integration
            </h3>
            <Field label="Booking Link">
              <Input value={form.booking_link} onChange={(e) => update("booking_link", e.target.value)} placeholder="https://cal.com/yourbusiness" />
            </Field>
            <Field label="Emergency / Handoff Number">
              <Input value={form.emergency_number} onChange={(e) => update("emergency_number", e.target.value)} placeholder="+1 (555) 000-0000" />
            </Field>
            <Field label="FAQs" rightLabel="Q: / A: format, blank line between pairs">
              <Textarea value={form.faqs} onChange={(e) => update("faqs", e.target.value)} placeholder="Q: Do you accept insurance?&#10;A: Yes, we accept most major plans." rows={5} />
            </Field>
            <Field label="Pricing Notes">
              <Textarea value={form.pricing_notes} onChange={(e) => update("pricing_notes", e.target.value)} placeholder="New patient exam $99 · Whitening from $299" rows={3} />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link to="/dashboard">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button
            type="submit"
            disabled={saving}
            className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white"
          >
            {saving ? "Creating…" : "Create Agent"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  rightLabel,
  required,
  children,
}: {
  label: string;
  rightLabel?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label>{label}{required && " "}</Label>
        {rightLabel && <span className="text-xs text-muted-foreground">{rightLabel}</span>}
      </div>
      {children}
    </div>
  );
}
