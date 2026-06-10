import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { NotificationsCard } from "@/components/dashboard/NotificationsCard";

export const Route = createFileRoute("/dashboard/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Ask Janice" }] }),
  component: NotificationsPage,
});

interface AgentRow {
  id: string;
  notify_email_transcript: boolean;
  notify_sms_transcript: boolean;
  notify_email: string | null;
  notify_phone: string | null;
}

function NotificationsPage() {
  const { user } = useAuth();
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("agents")
      .select("id, notify_email_transcript, notify_sms_transcript, notify_email, notify_phone")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setAgent(data as AgentRow | null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="px-4 md:px-8 py-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-foreground">Notifications</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Choose how you want to be notified after every call.
        </p>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : !agent ? (
        <div className="text-muted-foreground">No receptionist found.</div>
      ) : (
        <NotificationsCard
          agentId={agent.id}
          emailEnabled={agent.notify_email_transcript}
          smsEnabled={agent.notify_sms_transcript}
          email={agent.notify_email}
          phone={agent.notify_phone}
          onChange={(next) => setAgent((prev) => (prev ? { ...prev, ...next } : prev))}
        />
      )}
    </div>
  );
}
