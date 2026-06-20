import { useState } from "react";
import { Check, Play, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { speakText } from "@/lib/agent-voice.functions";
import { syncReceptionistAgent } from "@/lib/elevenlabs-agent.functions";
import { VOICE_OPTIONS, DEFAULT_VOICE_ID } from "@/lib/voices";
import { toast } from "sonner";

interface VoicePickerCardProps {
  agentId: string;
  businessName: string;
  currentVoiceId: string | null;
  onChange: (voiceId: string) => void;
}

/**
 * Big voice-picker card with cartoon avatars. Tapping an avatar switches the
 * receptionist's voice (saves to DB + syncs to ElevenLabs). The "Preview"
 * button plays a short sample without changing the saved voice.
 */
export function VoicePickerCard({
  agentId,
  businessName,
  currentVoiceId,
  onChange,
}: VoicePickerCardProps) {
  const speak = useServerFn(speakText);
  const syncEl = useServerFn(syncReceptionistAgent);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const selectedId = currentVoiceId ?? DEFAULT_VOICE_ID;

  const previewVoice = async (voiceId: string) => {
    setPreviewingId(voiceId);
    try {
      const sample = `Hi, thanks for calling ${businessName}. How can I help you today?`;
      const res = await speak({ data: { text: sample, voiceId } });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const audio = new Audio(`data:audio/mpeg;base64,${res.audioBase64}`);
      await audio.play();
      audio.onended = () => setPreviewingId((id) => (id === voiceId ? null : id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
      setPreviewingId(null);
    }
  };

  const selectVoice = async (voiceId: string) => {
    if (voiceId === selectedId || savingId) return;
    setSavingId(voiceId);
    const { error } = await supabase
      .from("agents")
      .update({ voice_id: voiceId })
      .eq("id", agentId);
    if (error) {
      setSavingId(null);
      toast.error("Couldn't save voice", { description: error.message });
      return;
    }
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (token) await syncEl({ data: { accessToken: token, agentId } });
    } catch (e) {
      console.error("EL sync exception:", e);
    }
    onChange(voiceId);
    setSavingId(null);
    toast.success("Voice updated");
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">Pick your receptionist's voice</h3>
        <p className="text-sm text-muted-foreground">
          Tap an avatar to switch voices. Use Preview to hear a sample first.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {VOICE_OPTIONS.map((v) => {
          const isSelected = v.id === selectedId;
          const isSaving = savingId === v.id;
          const isPreviewing = previewingId === v.id;
          return (
            <div
              key={v.id}
              className={`relative rounded-2xl border-2 p-3 flex flex-col items-center text-center transition cursor-pointer hover:border-[var(--gold)] ${
                isSelected
                  ? "border-[var(--gold)] bg-[oklch(0.97_0.03_85)]"
                  : "border-border bg-background"
              }`}
              onClick={() => selectVoice(v.id)}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-[var(--gold)] flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              <div className="w-20 h-20 rounded-full overflow-hidden bg-muted mb-2 flex items-center justify-center">
                {isSaving ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <img
                    src={v.avatar}
                    alt={`${v.name} cartoon avatar`}
                    width={512}
                    height={512}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <p className="font-semibold text-sm text-foreground">{v.name}</p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 mb-2">
                {v.description}
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  previewVoice(v.id);
                }}
                disabled={isPreviewing}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {isPreviewing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                Preview
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
