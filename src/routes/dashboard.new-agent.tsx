import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { scrapeBusinessFromUrl } from "@/server/agent-functions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/new-agent")({
  head: () => ({ meta: [{ title: "Build New Agent — Agent Factory" }] }),
  component: NewAgentPage,
});

interface AgentForm {
  business_name: string;
  industry: string;
  tone: string;
  primary_goal: string;
  services: string;
  booking_link: string;
  emergency_number: string;
  faqs: string;
  pricing_notes: string;
  escalation_triggers: string;
}

const empty: AgentForm = {
  business_name: "",
  industry: "",
  tone: "",
  primary_goal: "",
  services: "",
  booking_link: "",
  emergency_number: "",
  faqs: "",
  pricing_notes: "",
  escalation_triggers: "",
};

function NewAgentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const scrape = useServerFn(scrapeBusinessFromUrl);
  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [saving, setSaving] = useState(false);
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
        setForm(res.data);
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
    if (!user) return;
    if (!form.business_name.trim()) {
      toast.error("Business name is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("agents").insert({
      user_id: user.id,
      business_name: form.business_name,
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
