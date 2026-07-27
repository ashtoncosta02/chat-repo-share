import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ThumbsUp, ThumbsDown, Sparkles, Trash2, Loader2, Link as LinkIcon, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  listAgentFeedback,
  deleteAgentFeedback,
  submitAgentFeedback,
} from "@/lib/agent-coaching.functions";

interface CoachingRow {
  id: string;
  rating: "up" | "down" | "note";
  note: string | null;
  conversation_id: string | null;
  created_at: string;
}

export function AgentCoachingCard({ agentId }: { agentId: string }) {
  const listFn = useServerFn(listAgentFeedback);
  const deleteFn = useServerFn(deleteAgentFeedback);
  const submitFn = useServerFn(submitAgentFeedback);
  const [rows, setRows] = useState<CoachingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"corrections" | "wins" | "all" | "notes">(
    "corrections"
  );
  const [deleting, setDeleting] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await listFn({ data: { agentId } });
      if (res.success) setRows(res.rows as CoachingRow[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await deleteFn({ data: { id, agentId } });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("Removed. Receptionist updated.");
    } finally {
      setDeleting(null);
    }
  }

  async function handleAddNote(rating: "down" | "up" | "note") {
    const note = newNote.trim();
    if (!note) return;
    setSubmitting(true);
    try {
      const res = await submitFn({
        data: { agentId, rating, note, conversationId: null },
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setNewNote("");
      toast.success("Coaching note added. Receptionist will use it going forward.");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  const corrections = rows.filter((r) => r.rating === "down" && r.note?.trim());
  const wins = rows.filter((r) => r.rating === "up");
  const genericNotes = rows.filter((r) => r.rating === "note" && r.note?.trim());
  const shown =
    filter === "corrections"
      ? corrections
      : filter === "wins"
        ? wins
        : filter === "notes"
          ? genericNotes
          : rows;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1">
        <Sparkles className="h-4 w-4 text-[var(--gold)]" />
        Agent Coaching
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Every note here becomes a persistent instruction your receptionist follows
        on calls and chats. Delete a note to remove it from her instructions.
      </p>

      <div className="space-y-2 mb-4">
        <Textarea
          value={newNote}
          "text-sm text-muted-foreground"
          placeholder="e.g. Always ask for the caller's email before ending the call."
          className="min-h-[80px] text-sm px-2 py-1"
          onChange={(e) => setNewNote(e.target.value)}
        />
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => handleAddNote("down")}
            disabled={submitting || !newNote.trim()}
            className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <ThumbsDown className="h-4 w-4 mr-1" />
            )}
            Add correction
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAddNote("note")}
            disabled={submitting || !newNote.trim()}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Plus className="h-4 w-4 mr-1" />
            )}
            Add note
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          type="button"
          onClick={() => setFilter("corrections")}
          className={`text-xs px-3 py-1.5 rounded-full border ${
            filter === "corrections"
              ? "bg-[var(--gold)] text-white border-transparent"
              : "bg-background border-border text-foreground hover:bg-muted"
          }`}
        >
          Corrections ({corrections.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("wins")}
          className={`text-xs px-3 py-1.5 rounded-full border ${
            filter === "wins"
              ? "bg-[var(--gold)] text-white border-transparent"
              : "bg-background border-border text-foreground hover:bg-muted"
          }`}
        >
          What's working ({wins.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("notes")}
          className={`text-xs px-3 py-1.5 rounded-full border ${
            filter === "notes"
              ? "bg-[var(--gold)] text-white border-transparent"
              : "bg-background border-border text-foreground hover:bg-muted"
          }`}
        >
          Notes ({genericNotes.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`text-xs px-3 py-1.5 rounded-full border ${
            filter === "all"
              ? "bg-[var(--gold)] text-white border-transparent"
              : "bg-background border-border text-foreground hover:bg-muted"
          }`}
        >
          All ({rows.length})
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
          Loading…
        </div>
      ) : shown.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          No feedback yet. Open a thread and use the "How did your AI
          receptionist do?" card to leave your first coaching note.
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background"
            >
              {r.rating === "up" ? (
                <ThumbsUp className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <ThumbsDown className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                {r.note ? (
                  <div className="text-sm text-foreground whitespace-pre-wrap">
                    {r.note}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">
                    (no note)
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                  <span>{new Date(r.created_at).toLocaleString()}</span>
                  {r.conversation_id && (
                    <Link
                      to="/dashboard/conversations/$conversationId"
                      params={{ conversationId: r.conversation_id }}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <LinkIcon className="h-3 w-3" />
                      View thread
                    </Link>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(r.id)}
                disabled={deleting === r.id}
                className="text-muted-foreground hover:text-red-600 shrink-0"
              >
                {deleting === r.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
