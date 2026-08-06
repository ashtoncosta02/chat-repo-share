import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { getSystemHealth, getGlobalErrorFeed } from "@/lib/admin.functions";
import { getIntegrationCredentialHealth, replayFailedWebhooks } from "@/lib/webhook-health.functions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ArrowLeft, Shield, Activity, Phone, MessageSquare, Calendar, AlertTriangle, CheckCircle2, ExternalLink, KeyRound, RefreshCcw } from "lucide-react";


export const Route = createFileRoute("/dashboard/admin/health")({
  head: () => ({ meta: [{ title: "Admin · System health" }] }),
  component: AdminHealthPage,
});

type Health = Awaited<ReturnType<typeof getSystemHealth>>;
type Errors = Awaited<ReturnType<typeof getGlobalErrorFeed>>;
type Creds = Awaited<ReturnType<typeof getIntegrationCredentialHealth>>;


export function AdminHealthPage() {
  const { session } = useAuth();
  const { isAdmin, checked } = useIsAdmin();
  const navigate = useNavigate();
  const [data, setData] = useState<Health | null>(null);
  const [errorFeed, setErrorFeed] = useState<Errors | null>(null);
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const [sweep, setSweep] = useState<{ saved: number; skipped: number; errors: number } | null>(null);
  const [creds, setCreds] = useState<Creds | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [replay, setReplay] = useState<{ saved: number; duplicate: number; errors: number } | null>(null);

  const runSweep = async () => {
    setSweeping(true);
    try {
      const res = await fetch("/api/public/hooks/backfill-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json()) as { saved?: number; skipped?: number; errors?: number };
      setSweep({ saved: json.saved ?? 0, skipped: json.skipped ?? 0, errors: json.errors ?? 0 });
    } catch {
      setSweep({ saved: 0, skipped: 0, errors: 1 });
    } finally {
      setSweeping(false);
    }
  };

  const loadCreds = () => {
    if (!session?.access_token) return;
    getIntegrationCredentialHealth({ data: { accessToken: session.access_token } }).then(setCreds);
  };

  const runReplay = async () => {
    if (!session?.access_token) return;
    setReplaying(true);
    try {
      const r = await replayFailedWebhooks({ data: { accessToken: session.access_token } });
      if (r.success) setReplay({ saved: r.saved, duplicate: r.duplicate, errors: r.errors });
      loadCreds();
    } finally {
      setReplaying(false);
    }
  };

  useEffect(() => {
    if (checked && !isAdmin) navigate({ to: "/dashboard" });
  }, [checked, isAdmin, navigate]);

  const load = () => {
    if (!session?.access_token) return;
    setLoading(true);
    loadCreds();
    Promise.all([
      getSystemHealth({ data: { accessToken: session.access_token } }).then(setData),
      getGlobalErrorFeed({ data: { accessToken: session.access_token } }).then(setErrorFeed),
    ]).finally(() => setLoading(false));
  };


  useEffect(() => {
    if (isAdmin && session?.access_token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, session?.access_token]);

  if (!checked || !isAdmin) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (loading || !data || !("voice" in data)) {
    return (
      <div className="min-h-full">
        <PageHeader title="System health" description="Live signals across the whole platform." />
        <div className="p-8 text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const d = data as Extract<Health, { success: true }>;
  const missingPct = d.voice.completed > 0 ? Math.round((d.voice.missingTranscripts / d.voice.completed) * 100) : 0;
  const phonesUnlinked = d.integrations.phonesTotal - d.integrations.phonesLinked;

  const alerts: { level: "warn" | "ok"; msg: string }[] = [];
  if (d.voice.missingTranscripts > 0) alerts.push({ level: "warn", msg: `${d.voice.missingTranscripts} voice call(s) in last 24h are missing transcripts (${missingPct}%). Webhook may be misconfigured.` });
  if (phonesUnlinked > 0) alerts.push({ level: "warn", msg: `${phonesUnlinked} phone number(s) are NOT connected to ElevenLabs.` });
  if (d.integrations.googleCalendarExpired > 0) alerts.push({ level: "warn", msg: `${d.integrations.googleCalendarExpired} user(s) have expired Google Calendar tokens.` });
  if (d.agents.onboardingIncomplete > 0) alerts.push({ level: "warn", msg: `${d.agents.onboardingIncomplete} agent(s) have not completed onboarding.` });
  if (alerts.length === 0) alerts.push({ level: "ok", msg: "All systems healthy." });

  return (
    <div className="min-h-full">
      <PageHeader
        title="System health"
        description="Live signals across the whole platform — refresh every few minutes."
        breadcrumb={
          <Link to="/dashboard/admin" className="inline-flex items-center gap-1.5 hover:text-foreground">
            <Shield className="h-3.5 w-3.5" /> Admin
          </Link>
        }
        action={
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard/admin"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" /> Back to admin
            </Link>
            <button onClick={load} className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90">
              Refresh
            </button>
          </div>
        }
      />

      <div className="p-4 md:p-8 space-y-6 max-w-6xl">
        {/* Missed-call recovery */}
        <div className="rounded-xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold flex items-center gap-2"><Phone className="h-4 w-4" /> Missed-call recovery</div>
            <div className="text-xs text-muted-foreground mt-1">
              Runs automatically every hour. Pulls any phone call the post-call webhook failed to deliver and saves it to Threads.
              {sweep ? ` Last run: recovered ${sweep.saved}, already stored ${sweep.skipped}, errors ${sweep.errors}.` : ""}
            </div>
          </div>
          <button
            onClick={runSweep}
            disabled={sweeping}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            {sweeping ? "Recovering…" : "Recover now"}
          </button>
        </div>


        {/* Alerts */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <div className="text-sm font-semibold flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4" /> Alerts</div>
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-start gap-2 text-sm ${a.level === "warn" ? "text-red-700" : "text-green-700"}`}>
              {a.level === "warn" ? <span>⚠</span> : <CheckCircle2 className="h-4 w-4" />} {a.msg}
            </div>
          ))}
        </div>

        {/* Error feed — aggregated issues across all users */}
        {errorFeed && "errors" in errorFeed && errorFeed.errors && (
          <Section title={`Error feed (${errorFeed.errors.length})`} icon={<AlertTriangle className="h-4 w-4" />}>
            {errorFeed.errors.length === 0 ? (
              <div className="text-sm text-green-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> No errors detected across any user accounts.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {errorFeed.errors.map((e, i) => (
                  <Link
                    key={i}
                    to="/dashboard/admin/users/$userId"
                    params={{ userId: e.user_id }}
                    className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm hover:bg-muted/40 transition"
                  >
                    <span className="mt-0.5 text-base">{kindIcon(e.kind)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">{e.message}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {e.user_label}{e.detail ? ` · ${e.detail}` : ""}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">{new Date(e.at).toLocaleString()}</div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground mt-1" />
                  </Link>
                ))}
              </div>
            )}
          </Section>
        )}


        {/* Voice */}
        <Section title="Voice pipeline (last 24h)" icon={<Phone className="h-4 w-4" />}>
          <Stats>
            <Stat label="Total calls" value={d.voice.calls24h} />
            <Stat label="Completed" value={d.voice.completed} />
            <Stat label="Missing transcript" value={d.voice.missingTranscripts} warn={d.voice.missingTranscripts > 0} />
            <Stat label="Avg duration" value={`${d.voice.avgDurationSecs}s`} />
            <Stat label="Calls (7d)" value={d.voice.calls7d} />
          </Stats>
        </Section>

        {/* Widget */}
        <Section title="Chat widget (last 24h)" icon={<MessageSquare className="h-4 w-4" />}>
          <Stats>
            <Stat label="Conversations" value={d.widget.conversations24h} />
          </Stats>
        </Section>

        {/* Bookings */}
        <Section title="Bookings" icon={<Calendar className="h-4 w-4" />}>
          <Stats>
            <Stat label="Last 24h" value={d.bookings.last24h} />
            <Stat label="Last 7 days" value={d.bookings.last7d} />
          </Stats>
        </Section>

        {/* Integrations */}
        <Section title="Integrations health" icon={<Activity className="h-4 w-4" />}>
          <Stats>
            <Stat label="ElevenLabs linked" value={d.integrations.elevenLabsLinked} />
            <Stat label="Phones linked" value={`${d.integrations.phonesLinked} / ${d.integrations.phonesTotal}`} warn={phonesUnlinked > 0} />
            <Stat label="Calendars connected" value={d.integrations.googleCalendarConnected} />
            <Stat label="Calendar tokens expired" value={d.integrations.googleCalendarExpired} warn={d.integrations.googleCalendarExpired > 0} />
          </Stats>
        </Section>

        {/* Agents */}
        <Section title="Receptionists" icon={<Shield className="h-4 w-4" />}>
          <Stats>
            <Stat label="Total" value={d.agents.total} />
            <Stat label="Live" value={d.agents.live} />
            <Stat label="Onboarding incomplete" value={d.agents.onboardingIncomplete} warn={d.agents.onboardingIncomplete > 0} />
          </Stats>
        </Section>
      </div>
    </div>
  );
}

function kindIcon(kind: string): string {
  switch (kind) {
    case "missing_transcript": return "📞";
    case "phone_unlinked": return "🔌";
    case "gcal_expired": return "📅";
    case "onboarding_stuck": return "⏳";
    default: return "⚠";
  }
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-5 py-3 border-b border-border flex items-center gap-2">
        {icon}
        <h2 className="font-semibold text-foreground text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Stats({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{children}</div>;
}

function Stat({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl font-semibold mt-1 ${warn ? "text-red-700" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
