import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Clock, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  agentId: string;
  value: "immediate" | "after_4_rings";
  forwardPhone: string | null;
  onChange: (next: "immediate" | "after_4_rings") => void;
  onForwardPhoneChange: (next: string | null) => void;
}

function normalizeE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return null;
    return `+${digits}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function AnswerModeCard({
  agentId,
  value,
  forwardPhone,
  onChange,
  onForwardPhoneChange,
}: Props) {
  const [saving, setSaving] = useState<"immediate" | "after_4_rings" | null>(null);
  const [phoneDraft, setPhoneDraft] = useState(forwardPhone ?? "");
  const [phoneSaving, setPhoneSaving] = useState(false);

  const update = async (next: "immediate" | "after_4_rings") => {
    if (next === value) return;
    if (next === "after_4_rings" && !forwardPhone) {
      toast.error("Add your personal cell below first so we know where to forward.");
      return;
    }
    setSaving(next);
    const { error } = await supabase
      .from("agents")
      .update({ answer_mode: next })
      .eq("id", agentId);
    setSaving(null);
    if (error) {
      toast.error("Couldn't save answer mode.");
      console.error(error);
      return;
    }
    onChange(next);
    toast.success(
      next === "immediate"
        ? "AI will answer immediately."
        : "Your cell will ring first — AI answers if you don't pick up.",
    );
  };

  const savePhone = async () => {
    const trimmed = phoneDraft.trim();
    const normalized = trimmed ? normalizeE164(trimmed) : null;
    if (trimmed && !normalized) {
      toast.error("Enter a valid phone number (e.g. +15551234567).");
      return;
    }
    setPhoneSaving(true);
    const { error } = await supabase
      .from("agents")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ owner_forward_phone: normalized } as any)
      .eq("id", agentId);
    setPhoneSaving(false);
    if (error) {
      toast.error("Couldn't save your forwarding number.");
      console.error(error);
      return;
    }
    onForwardPhoneChange(normalized);
    setPhoneDraft(normalized ?? "");
    toast.success(normalized ? "Forwarding number saved." : "Forwarding number cleared.");
    // If they cleared the number while in forward mode, flip back to immediate.
    if (!normalized && value === "after_4_rings") {
      await supabase.from("agents").update({ answer_mode: "immediate" }).eq("id", agentId);
      onChange("immediate");
    }
  };

  return (
    <div className="border border-border rounded-2xl bg-card p-6">
      <div className="flex items-center gap-2 mb-1">
        <Phone className="h-4 w-4 text-[var(--gold)]" />
        <h2 className="font-display text-lg font-bold text-foreground">
          When a call comes in
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Choose how your AI receptionist picks up incoming calls. (Affects voice calls only —
        SMS is always answered immediately.)
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <ModeButton
          active={value === "immediate"}
          loading={saving === "immediate"}
          onClick={() => update("immediate")}
          icon={<Zap className="h-5 w-5" />}
          title="Answer immediately"
          description="Best for after-hours and forwarded calls — the AI answers instantly."
        />
        <ModeButton
          active={value === "after_4_rings"}
          loading={saving === "after_4_rings"}
          onClick={() => update("after_4_rings")}
          icon={<Clock className="h-5 w-5" />}
          title="Ring my cell first"
          description="Your phone rings ~4 times. AI answers if you don't pick up."
        />
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <label className="text-sm font-semibold text-foreground">Your personal cell</label>
        <p className="text-xs text-muted-foreground mb-2">
          Business calls will ring here first when "Ring my cell first" is on. Calls made
          directly to your personal number never touch the AI and won't be saved as threads.
        </p>
        <div className="flex gap-2">
          <Input
            value={phoneDraft}
            onChange={(e) => setPhoneDraft(e.target.value)}
            placeholder="+15551234567"
            inputMode="tel"
          />
          <Button
            type="button"
            onClick={savePhone}
            disabled={phoneSaving || phoneDraft.trim() === (forwardPhone ?? "")}
          >
            {phoneSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  loading,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  loading: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`text-left rounded-xl border p-4 transition ${
        active
          ? "border-[var(--gold)] bg-[oklch(0.97_0.04_290)] ring-2 ring-[var(--gold)]/30"
          : "border-border bg-background hover:border-[var(--gold)]/50"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={active ? "text-[var(--gold)]" : "text-muted-foreground"}>
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
        </span>
        <span className="font-semibold text-foreground">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  );
}
