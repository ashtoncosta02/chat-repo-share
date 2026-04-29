import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Calendar, Check, Copy, ExternalLink, Loader2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  startGoogleCalendarConnect,
  disconnectGoogleCalendar,
} from "@/server/google-calendar.functions";

interface Props {
  agentId: string;
}

interface Connection {
  google_email: string;
  calendar_name: string | null;
  timezone: string;
}

export function GoogleCalendarCard({ agentId }: Props) {
  const startConnect = useServerFn(startGoogleCalendarConnect);
  const disconnect = useServerFn(disconnectGoogleCalendar);
  const [conn, setConn] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("agent_google_calendar")
      .select("google_email, calendar_name, timezone")
      .eq("agent_id", agentId)
      .maybeSingle();
    setConn(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Refresh when window regains focus (after popup closes)
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const handleConnect = async () => {
    setBusy(true);
    setManualUrl(null);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        toast.error("Please sign in again.");
        return;
      }
      const res = await startConnect({ data: { accessToken, agent_id: agentId } });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setManualUrl(res.url);
      toast.success("Google authorization link is ready.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Google Calendar? Your agent will stop booking meetings.")) return;
    setBusy(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        toast.error("Please sign in again.");
        return;
      }
      const res = await disconnect({ data: { accessToken, agent_id: agentId } });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setConn(null);
      toast.success("Calendar disconnected");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading calendar…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-[oklch(0.95_0.05_75)] flex items-center justify-center shrink-0">
            <Calendar className="h-5 w-5 text-[var(--gold)]" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              Google Calendar
              {conn && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <Check className="h-3 w-3" /> Connected
                </span>
              )}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {conn
                ? `${conn.google_email} · ${conn.timezone}`
                : "Let your agent check availability and book meetings on your calendar."}
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {conn ? (
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={busy}>
              <Unlink className="h-3.5 w-3.5 mr-1.5" />
              Disconnect
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={busy}
              className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Connect Google Calendar
            </Button>
          )}
        </div>
      </div>
      {manualUrl && !conn && (
        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border bg-background/60 p-3">
          <p className="text-sm text-muted-foreground">
            If Google opens as blocked, copy this authorization URL and paste it into your browser address bar.
          </p>
          <div className="flex gap-2">
            <input
              value={manualUrl}
              readOnly
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground"
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(manualUrl);
                toast.success("Authorization URL copied");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <a
            href={manualUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Open Google Calendar authorization
          </a>
        </div>
      )}
    </div>
  );
}
