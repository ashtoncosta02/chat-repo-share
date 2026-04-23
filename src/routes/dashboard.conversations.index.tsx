import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/PageHeader";
import { MessageSquare, ChevronRight, Mic } from "lucide-react";

export const Route = createFileRoute("/dashboard/conversations/")({
  head: () => ({ meta: [{ title: "Conversations — Agent Factory" }] }),
  component: ConversationsPage,
});

interface ConvRow {
  id: string;
  message_count: number;
  duration_seconds: number;
  started_at: string;
  agent_id: string | null;
  recording_url: string | null;
}

function ConversationsPage() {
  const { user } = useAuth();
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("conversations")
      .select("id, message_count, duration_seconds, started_at, agent_id, recording_url")
      .order("started_at", { ascending: false })
      .then(({ data }) => {
        setConvs(data ?? []);
        setLoading(false);
      });
  }, [user]);

  const totalMs = convs.reduce((s, c) => s + c.message_count, 0);
  const avgMessages = convs.length ? Math.round(totalMs / convs.length) : 0;
  const totalDuration = convs.reduce((s, c) => s + c.duration_seconds, 0);
  const totalMin = Math.round(totalDuration / 60);

  return (
    <div>
      <PageHeader
        title="Conversations"
        description="Every conversation your agents have had, saved automatically"
      />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatRow label="Total Conversations" value={convs.length} color="text-foreground" />
          <StatRow label="Avg Messages" value={avgMessages} color="text-[var(--gold)]" />
          <StatRow label="Total Duration" value={`${totalMin}m`} color="text-emerald-600" />
        </div>

        <div className="rounded-xl border border-border bg-card">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : convs.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-16 w-16 text-muted-foreground/40" />}
              title="No conversations yet"
              description="Conversations are saved here automatically every time someone talks to one of your AI agents."
            />
          ) : (
            <ul className="divide-y divide-border">
              {convs.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/dashboard/conversations/$conversationId"
                    params={{ conversationId: c.id }}
                    className="px-6 py-4 flex items-center justify-between hover:bg-muted/40 transition"
                  >
                    <div>
                      <div className="font-medium text-foreground flex items-center gap-2">
                        {new Date(c.started_at).toLocaleString()}
                        {c.recording_url && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[oklch(0.95_0.05_75)] text-[var(--gold)]">
                            <Mic className="h-3 w-3" />
                            Recording
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {c.message_count} messages · {Math.round(c.duration_seconds / 60)}m
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className={`font-display text-3xl font-semibold ${color}`}>{value}</span>
    </div>
  );
}
