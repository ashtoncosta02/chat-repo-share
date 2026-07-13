import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Check, Copy, ExternalLink, Loader2, Mail, Settings, Unlink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  startOutlookCalendarConnect,
  disconnectOutlookCalendar,
  updateOutlookCalendarSettings,
  getOutlookCalendarHealth,
} from "@/lib/outlook-calendar.functions";
import { AlertTriangle } from "lucide-react";

interface Props {
  agentId: string;
}

interface DayHours {
  enabled: boolean;
  start: string;
  end: string;
}

type DayKey =
  | "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

type BusinessHours = Record<DayKey, DayHours>;

interface Connection {
  microsoft_account_email: string | null;
  calendar_name: string | null;
  timezone: string;
  default_event_duration_minutes: number;
  booking_buffer_minutes: number;
  business_hours: BusinessHours;
}

const DAY_LABELS: Array<{ key: DayKey; label: string }> = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

const COMMON_TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu", "America/Toronto",
  "America/Vancouver", "America/Mexico_City", "Europe/London", "Europe/Dublin",
  "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Amsterdam",
  "Europe/Stockholm", "Europe/Rome", "Australia/Sydney", "Australia/Melbourne",
  "Australia/Perth", "Asia/Tokyo", "Asia/Singapore", "Asia/Dubai", "UTC",
];

const DEFAULT_HOURS: BusinessHours = {
  sunday: { enabled: false, start: "09:00", end: "17:00" },
  monday: { enabled: true, start: "09:00", end: "17:00" },
  tuesday: { enabled: true, start: "09:00", end: "17:00" },
  wednesday: { enabled: true, start: "09:00", end: "17:00" },
  thursday: { enabled: true, start: "09:00", end: "17:00" },
  friday: { enabled: true, start: "09:00", end: "17:00" },
  saturday: { enabled: false, start: "09:00", end: "17:00" },
};

export function OutlookCalendarCard({ agentId }: Props) {
  const startConnect = useServerFn(startOutlookCalendarConnect);
  const disconnect = useServerFn(disconnectOutlookCalendar);
  const saveSettings = useServerFn(updateOutlookCalendarSettings);
  const healthFn = useServerFn(getOutlookCalendarHealth);
  const [conn, setConn] = useState<Connection | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [health, setHealth] = useState<"ok" | "needs_reconnect" | "error" | null>(null);
  const [healthReason, setHealthReason] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const [tz, setTz] = useState("America/New_York");
  const [duration, setDuration] = useState(30);
  const [buffer, setBuffer] = useState(15);
  const [hours, setHours] = useState<BusinessHours>(DEFAULT_HOURS);
  const [savingSettings, setSavingSettings] = useState(false);

  const load = async () => {
    const [{ data }, { data: googleRow }] = await Promise.all([
      supabase
        .from("agent_outlook_calendar")
        .select(
          "microsoft_account_email, calendar_name, timezone, default_event_duration_minutes, booking_buffer_minutes, business_hours",
        )
        .eq("agent_id", agentId)
        .maybeSingle(),
      supabase.from("agent_google_calendar").select("id").eq("agent_id", agentId).maybeSingle(),
    ]);
    setGoogleConnected(Boolean(googleRow));
    if (data) {
      const c: Connection = {
        microsoft_account_email: data.microsoft_account_email,
        calendar_name: data.calendar_name,
        timezone: data.timezone,
        default_event_duration_minutes: data.default_event_duration_minutes,
        booking_buffer_minutes: data.booking_buffer_minutes,
        business_hours: (data.business_hours as unknown as BusinessHours) ?? DEFAULT_HOURS,
      };
      setConn(c);
      setTz(c.timezone);
      setDuration(c.default_event_duration_minutes);
      setBuffer(c.booking_buffer_minutes);
      setHours(c.business_hours);
    } else {
      setConn(null);
    }
    setLoading(false);
  };

  const checkHealth = async () => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;
      const res = await healthFn({ data: { accessToken, agent_id: agentId } });
      if (res.status === "ok") {
        setHealth("ok");
        setHealthReason(null);
      } else if (res.status === "needs_reconnect") {
        setHealth("needs_reconnect");
        setHealthReason("reason" in res ? res.reason ?? null : null);
      } else if (res.status === "not_connected") {
        setHealth(null);
        setHealthReason(null);
      } else {
        setHealth("error");
        setHealthReason("error" in res ? res.error ?? null : null);
      }
      setLastChecked(new Date());
    } catch (e) {
      console.error("outlook health check failed", e);
    }
  };

  useEffect(() => {
    load().then(() => checkHealth());
    const onFocus = () => {
      load();
      checkHealth();
    };
    window.addEventListener("focus", onFocus);
    const interval = setInterval(checkHealth, 5 * 60 * 1000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const handleConnect = async () => {
    if (googleConnected && !conn) {
      if (!confirm("Connecting Outlook will disconnect your Google Calendar. Continue?")) return;
    }
    setBusy(true);
    setManualUrl(null);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) { toast.error("Please sign in again."); return; }
      const res = await startConnect({ data: { accessToken, agent_id: agentId } });
      if (!res.success) { toast.error(res.error); return; }
      setManualUrl(res.url);
      window.open(res.url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect");
    } finally { setBusy(false); }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Outlook Calendar? Your receptionist will stop booking meetings.")) return;
    setBusy(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) { toast.error("Please sign in again."); return; }
      const res = await disconnect({ data: { accessToken, agent_id: agentId } });
      if (!res.success) { toast.error(res.error); return; }
      setConn(null);
      setShowSettings(false);
      toast.success("Outlook disconnected");
    } finally { setBusy(false); }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) { toast.error("Please sign in again."); return; }
      for (const day of Object.keys(hours) as DayKey[]) {
        const h = hours[day];
        if (!/^\d{1,2}:\d{2}$/.test(h.start) || !/^\d{1,2}:\d{2}$/.test(h.end)) {
          toast.error(`Invalid time format for ${day}`); return;
        }
      }
      const res = await saveSettings({
        data: {
          accessToken, agent_id: agentId, timezone: tz,
          default_event_duration_minutes: duration,
          booking_buffer_minutes: buffer, business_hours: hours,
        },
      });
      if (!res.success) { toast.error(res.error); return; }
      toast.success("Booking settings saved");
      await load();
    } finally { setSavingSettings(false); }
  };

  const updateDay = (key: DayKey, patch: Partial<DayHours>) => {
    setHours((h) => ({ ...h, [key]: { ...h[key], ...patch } }));
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading Outlook…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-[oklch(0.95_0.05_240)] flex items-center justify-center shrink-0">
            <Mail className="h-5 w-5 text-[#0078d4]" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              Outlook Calendar
              {conn && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <Check className="h-3 w-3" /> Connected
                </span>
              )}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {conn
                ? `${conn.microsoft_account_email ?? "Outlook"} · ${conn.timezone}`
                : "For Microsoft 365, Outlook.com, or Hotmail accounts."}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {conn && (
            <Button variant="outline" size="sm" onClick={() => setShowSettings((v) => !v)}>
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              {showSettings ? "Hide settings" : "Booking settings"}
            </Button>
          )}
          {conn ? (
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={busy}>
              <Unlink className="h-3.5 w-3.5 mr-1.5" /> Disconnect
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={busy}
              className="bg-[#0078d4] hover:bg-[#0078d4]/90 text-white"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Connect Outlook
            </Button>
          )}
        </div>
      </div>

      {manualUrl && !conn && (
        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border bg-background/60 p-3">
          <p className="text-sm text-muted-foreground">
            A new tab should have opened. If your browser blocked it, open the link below.
          </p>
          <div className="flex gap-2">
            <input
              value={manualUrl} readOnly
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground"
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button type="button" variant="outline" size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(manualUrl);
                toast.success("Authorization URL copied");
              }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <a href={manualUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            <ExternalLink className="h-4 w-4" />
            Open Outlook authorization
          </a>
        </div>
      )}

      {conn && showSettings && (
        <div className="mt-5 border-t border-border pt-5 space-y-5">
          <div>
            <h4 className="font-medium text-foreground text-sm mb-1">Booking settings</h4>
            <p className="text-xs text-muted-foreground">
              Your receptionist will only offer slots inside these hours, in your timezone.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-foreground mb-1">Timezone</span>
              <select value={tz} onChange={(e) => setTz(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm">
                {COMMON_TIMEZONES.includes(tz) ? null : <option value={tz}>{tz}</option>}
                {COMMON_TIMEZONES.map((z) => (<option key={z} value={z}>{z}</option>))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-foreground mb-1">
                Default appointment length (min)
              </span>
              <input type="number" min={5} max={480} value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-foreground mb-1">
                Buffer between bookings (min)
              </span>
              <input type="number" min={0} max={240} value={buffer}
                onChange={(e) => setBuffer(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
            </label>
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-foreground">Business hours</span>
            <div className="rounded-lg border border-border divide-y divide-border">
              {DAY_LABELS.map(({ key, label }) => {
                const h = hours[key];
                return (
                  <div key={key} className="flex items-center gap-3 px-3 py-2">
                    <label className="flex items-center gap-2 w-20 shrink-0">
                      <input type="checkbox" checked={h.enabled}
                        onChange={(e) => updateDay(key, { enabled: e.target.checked })}
                        className="h-4 w-4" />
                      <span className="text-sm font-medium text-foreground">{label}</span>
                    </label>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input type="time" value={h.start} disabled={!h.enabled}
                        onChange={(e) => updateDay(key, { start: e.target.value })}
                        className="px-2 py-1 rounded border border-border bg-background text-sm disabled:opacity-50" />
                      <span className="text-sm text-muted-foreground">to</span>
                      <input type="time" value={h.end} disabled={!h.enabled}
                        onChange={(e) => updateDay(key, { end: e.target.value })}
                        className="px-2 py-1 rounded border border-border bg-background text-sm disabled:opacity-50" />
                      {!h.enabled && (<span className="text-xs text-muted-foreground ml-auto">Closed</span>)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={handleSaveSettings} disabled={savingSettings}
              className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white">
              {savingSettings && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save settings
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
