import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Clock, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  agentId: string;
  value: "immediate" | "after_4_rings";
  onChange: (next: "immediate" | "after_4_rings") => void;
}

export function AnswerModeCard({ agentId, value, onChange }: Props) {
  const [saving, setSaving] = useState<"immediate" | "after_4_rings" | null>(null);

  const update = async (next: "immediate" | "after_4_rings") => {
    if (next === value) return;
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
        : "AI will answer after 4 rings.",
    );
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
          description="AI picks up on the first ring."
        />
        <ModeButton
          active={value === "after_4_rings"}
          loading={saving === "after_4_rings"}
          onClick={() => update("after_4_rings")}
          icon={<Clock className="h-5 w-5" />}
          title="After 4 rings"
          description="Phone rings 4 times, then AI answers."
        />
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
          ? "border-[var(--gold)] bg-[oklch(0.97_0.04_80)] ring-2 ring-[var(--gold)]/30"
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
