import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ThumbsUp, ThumbsDown, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  submitAgentFeedback,
  getConversationFeedback,
} from "@/lib/agent-coaching.functions";

interface FeedbackRow {
  id: string;
  rating: "up" | "down";
  note: string | null;
  created_at: string;
}

export function ThreadFeedbackCard({
  agentId,
  conversationId,
}: {
  agentId: string;
  conversationId: string;
}) {
  const submit = useServerFn(submitAgentFeedback);
  const listFn = useServerFn(getConversationFeedback);

  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listFn({ data: { conversationId } });
        if (!cancelled && res.success) setExisting(res.rows as FeedbackRow[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, listFn]);

  async function handleSubmit(chosen: "up" | "down") {
    setSaving(true);
    try {
      const res = await submit({
        data: {
          agentId,
          conversationId,
          rating: chosen,
          note: note.trim() || null,
        },
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(
        chosen === "down" && note.trim()
          ? "Coaching saved — your receptionist will apply this on the next call."
          : "Thanks for the feedback!"
      );
      setExisting((prev) => [
        {
          id: res.id,
          rating: chosen,
          note: note.trim() || null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setNote("");
      setRating(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1">
        <Sparkles className="h-4 w-4 text-[var(--gold)]" />
        How did your AI receptionist do?
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Your feedback trains the receptionist — corrections are applied to
        every call and chat going forward.
      </p>

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setRating("up")}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition ${
            rating === "up"
              ? "bg-green-50 border-green-500 text-green-700"
              : "bg-background border-border text-foreground hover:bg-muted"
          }`}
        >
          <ThumbsUp className="h-4 w-4" /> Good
        </button>
        <button
          type="button"
          onClick={() => setRating("down")}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition ${
            rating === "down"
              ? "bg-red-50 border-red-500 text-red-700"
              : "bg-background border-border text-foreground hover:bg-muted"
          }`}
        >
          <ThumbsDown className="h-4 w-4" /> Needs work
        </button>
      </div>

      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 2000))}
        rows={3}
        placeholder={
          rating === "down"
            ? "What should she have done differently? (e.g. 'Don't confirm times without checking the calendar')"
            : "Optional: what worked, or anything you'd like her to keep doing?"
        }
        className="mb-2"
      />
      <div className="text-xs text-muted-foreground text-right mb-2">
        {note.length}/2000
      </div>
      <Button
        onClick={() => rating && handleSubmit(rating)}
        disabled={!rating || saving}
        className="w-full"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…
          </>
        ) : (
          "Save feedback"
        )}
      </Button>

      {!loading && existing.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your previous feedback on this thread
          </div>
          {existing.map((f) => (
            <div
              key={f.id}
              className="flex items-start gap-2 text-sm p-2 rounded-lg bg-muted/50"
            >
              {f.rating === "up" ? (
                <ThumbsUp className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <ThumbsDown className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                {f.note && (
                  <div className="text-foreground whitespace-pre-wrap">
                    {f.note}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(f.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
