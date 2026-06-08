import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { getAdminUserDetail, adminBackfillUserCalls, adminRelinkPhone, adminResyncReceptionist, adminClearGoogleCalendar } from "@/lib/admin.functions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Shield, ArrowLeft, AlertTriangle, CheckCircle2, Phone, Calendar, MessageSquare, User as UserIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/admin/users/$userId")({
  head: () => ({ meta: [{ title: "Admin · User detail" }] }),
  component: AdminUserDetailPage,
});

type Detail = Awaited<ReturnType<typeof getAdminUserDetail>>;

function AdminUserDetailPage() {
  const { userId } = Route.useParams();
  const { session } = useAuth();
  const { isAdmin, checked } = useIsAdmin();
  const navigate = useNavigate();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState(false);

  useEffect(() => {
    if (checked && !isAdmin) navigate({ to: "/dashboard" });
  }, [checked, isAdmin, navigate]);

  const load = () => {
    if (!session?.access_token) return;
    setLoading(true);
    getAdminUserDetail({ data: { accessToken: session.access_token, userId } })
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAdmin && session?.access_token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, session?.access_token, userId]);

  const runBackfill = async () => {
    if (!session?.access_token) return;
    setBackfilling(true);
    try {
      const r = await adminBackfillUserCalls({ data: { accessToken: session.access_token, userId } });
      if (r.success) toast.success(`Backfill done: saved ${r.saved}, skipped ${r.skipped}, errors ${r.errors}`);
      else toast.error(r.error);
      load();
    } finally {
      setBackfilling(false);
    }
  };

  const [busy, setBusy] = useState<string | null>(null);
  const runFix = async (key: string, fn: () => Promise<{ success: boolean; error?: string; alreadyLinked?: boolean }>, okMsg: string) => {
    if (!session?.access_token) return;
    setBusy(key);
    try {
      const r = await fn();
      if (r.success) toast.success(r.alreadyLinked ? "Already linked." : okMsg);
      else toast.error(r.error ?? "Failed.");
      load();
    } finally {
      setBusy(null);
    }
  };
  const relinkPhone = (id: string) => runFix(`phone-${id}`,
    () => adminRelinkPhone({ data: { accessToken: session!.access_token, phoneNumberId: id } }),
    "Phone connected to AI.");
  const resyncReceptionist = () => runFix("resync",
    () => adminResyncReceptionist({ data: { accessToken: session!.access_token, userId } }),
    "Receptionist resynced.");
  const clearGcal = () => {
    if (!confirm("Clear this user's Google Calendar connection? They will need to reconnect from their dashboard.")) return;
    runFix("gcal",
      () => adminClearGoogleCalendar({ data: { accessToken: session!.access_token, userId } }),
      "Calendar connection cleared. User can now reconnect.");
  };

  if (!checked || !isAdmin) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (loading || !data) return <div className="p-8 text-muted-foreground">Loading account…</div>;
  if (!("profile" in data) || !data.profile) return <div className="p-8 text-muted-foreground">User not found.</div>;

  const d = data as Extract<Detail, { success: true }>;
  const profile = d.profile!;


  return (
    <div className="min-h-full">
      <PageHeader
        title={profile.display_name || profile.email || "User"}
        description={profile.email ?? undefined}
        breadcrumb={
          <Link to="/dashboard/admin/users" className="inline-flex items-center gap-1.5 hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> All users
          </Link>
        }
        action={
          <button
            onClick={runBackfill}
            disabled={backfilling}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${backfilling ? "animate-spin" : ""}`} /> Backfill voice calls
          </button>
        }
      />

      <div className="p-4 md:p-8 space-y-6 max-w-6xl">
        {/* Health */}
        <Section title="Account health" icon={<AlertTriangle className="h-4 w-4" />}>
          {d.healthIssues.length === 0 ? (
            <div className="flex items-center gap-2 text-green-700 text-sm">
              <CheckCircle2 className="h-4 w-4" /> No issues detected.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {d.healthIssues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                  <span className="mt-0.5">⚠</span> {issue}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Account */}
        <Section title="Account" icon={<UserIcon className="h-4 w-4" />}>
          <Grid>
            <Field label="Email" value={profile.email} />
            <Field label="Name" value={profile.display_name} />
            <Field label="Signed up" value={new Date(profile.created_at).toLocaleString()} />
            <Field label="Last sign-in" value={d.authUser?.last_sign_in_at ? new Date(d.authUser.last_sign_in_at).toLocaleString() : "Never"} />
            <Field label="Email confirmed" value={d.authUser?.email_confirmed_at ? "Yes" : "No"} />
            <Field label="Admin" value={d.isAdmin ? "Yes" : "No"} />
          </Grid>
        </Section>

        {/* Receptionist */}
        <Section title="Receptionist" icon={<Shield className="h-4 w-4" />}>
          {d.agent ? (
            <Grid>
              <Field label="Business name" value={d.agent.business_name} />
              <Field label="Industry" value={d.agent.industry} />
              <Field label="Status" value={d.agent.is_live ? "● Live" : "○ Draft"} />
              <Field label="Onboarding" value={d.agent.onboarding_completed ? "Complete" : "Incomplete"} />
              <Field label="Voice ID" value={d.agent.voice_id} />
              <Field label="Answer mode" value={d.agent.answer_mode} />
              <Field label="ElevenLabs agent" value={d.agent.elevenlabs_agent_id ?? "— not linked"} mono />
              <Field label="SMS follow-up" value={d.agent.sms_followup_enabled ? "On" : "Off"} />
              <Field label="Notify email" value={d.agent.notify_email} />
              <Field label="Notify phone" value={d.agent.notify_phone} />
            </Grid>
          ) : (
            <Empty>No receptionist created yet.</Empty>
          )}
          {d.agent && (
            <div className="mt-4 pt-4 border-t border-border">
              <button
                onClick={resyncReceptionist}
                disabled={busy === "resync"}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${busy === "resync" ? "animate-spin" : ""}`} />
                Resync receptionist to ElevenLabs
              </button>
              <p className="text-[11px] text-muted-foreground mt-1.5">Pushes the current prompt, voice, and FAQs back to ElevenLabs.</p>
            </div>
          )}
        </Section>

        {/* Phone numbers */}
        <Section title="Phone numbers" icon={<Phone className="h-4 w-4" />}>
          {d.phones.length === 0 ? (
            <Empty>No phone numbers.</Empty>
          ) : (
            <div className="space-y-2">
              {d.phones.map((p: any) => (
                <div key={p.id} className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{p.phone_number}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      Twilio SID: <code className="font-mono">{p.twilio_sid}</code> · status: {p.status}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {p.elevenlabs_phone_number_id ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] text-green-700">✓ Linked to AI</span>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-700">⚠ Not linked</span>
                        <button
                          onClick={() => relinkPhone(p.id)}
                          disabled={busy === `phone-${p.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-foreground px-3 py-1 text-[11px] font-medium text-background hover:opacity-90 disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 ${busy === `phone-${p.id}` ? "animate-spin" : ""}`} />
                          Connect to AI
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Google Calendar */}
        <Section title="Google Calendar" icon={<Calendar className="h-4 w-4" />}>
          {d.googleCalendar ? (
            <>
              <Grid>
                <Field label="Connected as" value={d.googleCalendar.google_email} />
                <Field label="Calendar" value={d.googleCalendar.calendar_name || d.googleCalendar.calendar_id} />
                <Field label="Timezone" value={d.googleCalendar.timezone} />
                <Field label="Default duration" value={`${d.googleCalendar.default_event_duration_minutes} min`} />
                <Field
                  label="Token status"
                  value={d.googleCalendar.token_expired ? "⚠ EXPIRED — needs reconnect" : "✓ Valid"}
                />
                <Field label="Token expires" value={new Date(d.googleCalendar.token_expires_at).toLocaleString()} />
              </Grid>
              <div className="mt-4 pt-4 border-t border-border">
                <button
                  onClick={clearGcal}
                  disabled={busy === "gcal"}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  Clear calendar connection
                </button>
                <p className="text-[11px] text-muted-foreground mt-1.5">Removes the stored tokens so the user can reconnect from their dashboard. Use when token is stuck/expired.</p>
              </div>
            </>
          ) : (
            <Empty>Not connected.</Empty>
          )}
        </Section>

        {/* Voice calls */}
        <Section title={`Recent voice calls (${d.voiceConversations.length})`} icon={<Phone className="h-4 w-4" />}>
          {d.voiceConversations.length === 0 ? (
            <Empty>No voice calls yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2 pr-3">Started</th>
                    <th className="text-right py-2 pr-3">Duration</th>
                    <th className="text-right py-2 pr-3">Messages</th>
                    <th className="text-left py-2 pr-3">Transcript</th>
                    <th className="text-left py-2">EL ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {d.voiceConversations.map((c: any) => (
                    <tr key={c.id}>
                      <td className="py-2 pr-3 whitespace-nowrap">{new Date(c.started_at).toLocaleString()}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{c.duration_seconds}s</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{c.message_count}</td>
                      <td className="py-2 pr-3">
                        {c.ai_summary ? (
                          <span className="text-green-700 text-xs">✓ Saved</span>
                        ) : c.ended_at ? (
                          <span className="text-red-700 text-xs">⚠ Missing</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">In progress</span>
                        )}
                      </td>
                      <td className="py-2 font-mono text-[11px] text-muted-foreground truncate max-w-[150px]">{c.elevenlabs_conversation_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Widget convos */}
        <Section title={`Recent chats (${d.widgetConversations.length})`} icon={<MessageSquare className="h-4 w-4" />}>
          {d.widgetConversations.length === 0 ? (
            <Empty>No widget conversations.</Empty>
          ) : (
            <div className="space-y-1.5 text-sm">
              {d.widgetConversations.map((c: any) => (
                <div key={c.id} className="flex justify-between border-b border-border pb-1.5">
                  <div className="truncate">
                    <span className="font-medium">{c.visitor_name || c.visitor_email || "Anonymous"}</span>
                    {c.page_url && <span className="text-xs text-muted-foreground"> · {c.page_url}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap ml-2">{new Date(c.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Bookings */}
        <Section title={`Bookings (${d.bookings.length})`} icon={<Calendar className="h-4 w-4" />}>
          {d.bookings.length === 0 ? (
            <Empty>No bookings.</Empty>
          ) : (
            <div className="space-y-1.5 text-sm">
              {d.bookings.map((b: any) => (
                <div key={b.id} className="flex justify-between border-b border-border pb-1.5">
                  <div>
                    <div className="font-medium">{b.customer_name || b.customer_email || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{new Date(b.starts_at).toLocaleString()} · {b.source} · {b.status}</div>
                  </div>
                  {b.google_event_link && (
                    <a href={b.google_event_link} target="_blank" rel="noreferrer" className="text-xs text-[var(--gold)] hover:underline">
                      View in Calendar →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Leads */}
        <Section title={`Recent leads (${d.leads.length})`} icon={<UserIcon className="h-4 w-4" />}>
          {d.leads.length === 0 ? (
            <Empty>No leads.</Empty>
          ) : (
            <div className="space-y-1.5 text-sm">
              {d.leads.map((l: any) => (
                <div key={l.id} className="flex justify-between border-b border-border pb-1.5">
                  <div>
                    <div className="font-medium">{l.name || l.email || l.phone || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{l.email} · {l.phone} · source: {l.source ?? "—"}</div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap ml-2">{new Date(l.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
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

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">{children}</div>;
}

function Field({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm text-foreground ${mono ? "font-mono text-xs break-all" : ""}`}>
        {value === null || value === undefined || value === "" ? <span className="text-muted-foreground italic">—</span> : String(value)}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground italic">{children}</div>;
}
