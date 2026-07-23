import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { getAdminUserDetail, adminBackfillUserCalls, adminRelinkPhone, adminResyncReceptionist, adminClearGoogleCalendar, adminSetUserPlan, adminSetUserBilling, adminUpdateAgent, adminUpdateProfile, adminImpersonateUser, adminDeleteUser } from "@/lib/admin.functions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Shield, ArrowLeft, AlertTriangle, CheckCircle2, Phone, Calendar, MessageSquare, User as UserIcon, RefreshCw, Pencil, Save, X, LogIn, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveAdminReturnSession } from "@/components/dashboard/ImpersonationBanner";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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

  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const doDelete = async () => {
    if (!session?.access_token) return;
    setDeleting(true);
    try {
      const r = await adminDeleteUser({ data: { accessToken: session.access_token, userId } });
      if (r.success) {
        toast.success("User and all their data deleted.");
        navigate({ to: "/dashboard/admin/users" });
      } else {
        toast.error(r.error ?? "Delete failed.");
        setDeleting(false);
      }
    } catch {
      setDeleting(false);
    }
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
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={async () => {
                if (!session?.access_token || !session?.refresh_token) return;
                if (!confirm(`Sign in as ${profile.email}? You will be signed out of your admin account and signed in as this user. A banner will let you return.`)) return;
                const reason = prompt("Reason for accessing this account (logged for audit):", "Customer support") ?? undefined;
                const r = await adminImpersonateUser({ data: { accessToken: session.access_token, userId, reason } });
                if (!r.success) { toast.error(r.error); return; }
                saveAdminReturnSession(
                  { access_token: session.access_token, refresh_token: session.refresh_token },
                  session.user?.email,
                );
                await supabase.auth.signOut();
                window.location.href = r.actionLink;
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              <LogIn className="h-4 w-4" /> Open as user
            </button>
            <button
              onClick={runBackfill}
              disabled={backfilling}
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${backfilling ? "animate-spin" : ""}`} /> Backfill voice calls
            </button>
            <button
              onClick={() => setShowDelete(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm font-medium hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" /> Delete user
            </button>
          </div>
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
          <EditableProfile
            profile={profile}
            authUser={d.authUser}
            isAdminRow={d.isAdmin}
            onSave={async (patch) => {
              if (!session?.access_token) return false;
              const r = await adminUpdateProfile({ data: { accessToken: session.access_token, userId, patch } });
              if (r.success) { toast.success("Profile updated"); load(); return true; }
              toast.error(r.error ?? "Failed"); return false;
            }}
          />
          <div className="mt-4 pt-4 border-t border-border flex items-center gap-3">
            <label className="text-xs text-muted-foreground">Plan:</label>
            <select
              defaultValue={(profile as any).plan ?? "standard"}
              onChange={async (e) => {
                if (!session?.access_token) return;
                const r = await adminSetUserPlan({ data: { accessToken: session.access_token, userId, plan: e.target.value as any } });
                if (r.success) toast.success("Plan updated"); else toast.error(r.error ?? "Failed");
                load();
              }}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
            >
              <option value="free">Free (comped)</option>
              <option value="discounted">Discounted</option>
              <option value="standard">Standard</option>
            </select>
            <span className="text-[11px] text-muted-foreground">Label only — no charges happen yet.</span>
          </div>
          <BillingOverrides
            profile={profile}
            onSave={async (priceCents, freeUntil) => {
              if (!session?.access_token) return false;
              const r = await adminSetUserBilling({ data: {
                accessToken: session.access_token,
                userId,
                monthly_price_override_cents: priceCents,
                first_month_free_until: freeUntil,
              }});
              if (r.success) { toast.success("Billing overrides saved"); load(); return true; }
              toast.error(r.error ?? "Failed"); return false;
            }}
          />
        </Section>

        {/* Receptionist */}
        <Section title="Receptionist" icon={<Shield className="h-4 w-4" />}>
          {d.agent ? (
            <EditableAgent
              agent={d.agent}
              onSave={async (patch) => {
                if (!session?.access_token) return false;
                const r = await adminUpdateAgent({ data: { accessToken: session.access_token, userId, patch } });
                if (r.success) { toast.success(`Saved ${r.fields.length} field(s)`); load(); return true; }
                toast.error(r.error ?? "Failed"); return false;
              }}
            />
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
              <p className="text-[11px] text-muted-foreground mt-1.5">After editing, click resync to push the changes to the live voice agent.</p>
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

      <ConfirmDialog
        open={showDelete}
        onOpenChange={(o) => !o && !deleting && setShowDelete(false)}
        title={`Delete ${profile.display_name || profile.email || "this user"}?`}
        description={
          <span>
            This permanently removes their account, receptionist, conversations, leads, bookings,
            and all related data. Any invitations for <strong>{profile.email}</strong> will also
            be cleared so the address can be re-invited. This cannot be undone.
          </span>
        }
        confirmLabel="Delete permanently"
        destructive
        loading={deleting}
        onConfirm={doDelete}
      />
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

// ----- Editable profile -----
function EditableProfile({
  profile,
  authUser,
  isAdminRow,
  onSave,
}: {
  profile: any;
  authUser: any;
  isAdminRow: boolean;
  onSave: (patch: { display_name?: string; email?: string }) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <>
        <Grid>
          <Field label="Email" value={profile.email} />
          <Field label="Name" value={profile.display_name} />
          <Field label="Signed up" value={new Date(profile.created_at).toLocaleString()} />
          <Field label="Last sign-in" value={authUser?.last_sign_in_at ? new Date(authUser.last_sign_in_at).toLocaleString() : "Never"} />
          <Field label="Email confirmed" value={authUser?.email_confirmed_at ? "Yes" : "No"} />
          <Field label="Admin" value={isAdminRow ? "Yes" : "No"} />
        </Grid>
        <button onClick={() => setEditing(true)} className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--gold)] hover:underline">
          <Pencil className="h-3 w-3" /> Edit profile
        </button>
      </>
    );
  }

  return (
    <div className="space-y-3">
      <TextField label="Display name" value={displayName} onChange={setDisplayName} />
      <TextField label="Email (profile only — does not change login email)" value={email} onChange={setEmail} />
      <div className="flex gap-2">
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            const patch: any = {};
            if (displayName !== (profile.display_name ?? "")) patch.display_name = displayName;
            if (email !== (profile.email ?? "")) patch.email = email;
            const ok = await onSave(patch);
            setSaving(false);
            if (ok) setEditing(false);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}

// ----- Editable agent (receptionist) -----
type AgentPatch = {
  business_name?: string;
  industry?: string;
  system_prompt?: string;
  greeting?: string;
  services_text?: string;
  faqs_text?: string;
  notify_email?: string;
  notify_phone?: string;
  sms_followup_enabled?: boolean;
  is_live?: boolean;
  answer_mode?: string;
  voice_id?: string;
  tone?: string;
  primary_goal?: string;
  booking_link?: string;
  emergency_number?: string;
  pricing_notes?: string;
  escalation_triggers?: string;
};

function EditableAgent({
  agent,
  onSave,
}: {
  agent: any;
  onSave: (patch: AgentPatch) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<AgentPatch>({});
  const [saving, setSaving] = useState(false);

  const initForm = (): AgentPatch => ({
    business_name: agent.business_name ?? "",
    industry: agent.industry ?? "",
    system_prompt: agent.system_prompt ?? "",
    greeting: agent.greeting ?? "",
    services_text: agent.services_text ?? "",
    faqs_text: agent.faqs_text ?? "",
    notify_email: agent.notify_email ?? "",
    notify_phone: agent.notify_phone ?? "",
    sms_followup_enabled: !!agent.sms_followup_enabled,
    is_live: !!agent.is_live,
    answer_mode: agent.answer_mode ?? "",
    voice_id: agent.voice_id ?? "",
    tone: agent.tone ?? "",
    primary_goal: agent.primary_goal ?? "",
    booking_link: agent.booking_link ?? "",
    emergency_number: agent.emergency_number ?? "",
    pricing_notes: agent.pricing_notes ?? "",
    escalation_triggers: agent.escalation_triggers ?? "",
  });

  const startEdit = () => {
    setForm(initForm());
    setEditing(true);
  };

  if (!editing) {
    return (
      <>
        <Grid>
          <Field label="Business name" value={agent.business_name} />
          <Field label="Industry" value={agent.industry} />
          <Field label="Status" value={agent.is_live ? "● Live" : "○ Draft"} />
          <Field label="Onboarding" value={agent.onboarding_completed ? "Complete" : "Incomplete"} />
          <Field label="Voice ID" value={agent.voice_id} />
          <Field label="Answer mode" value={agent.answer_mode} />
          <Field label="ElevenLabs agent" value={agent.elevenlabs_agent_id ?? "— not linked"} mono />
          <Field label="SMS follow-up" value={agent.sms_followup_enabled ? "On" : "Off"} />
          <Field label="Notify email" value={agent.notify_email} />
          <Field label="Notify phone" value={agent.notify_phone} />
        </Grid>
        <button onClick={startEdit} className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--gold)] hover:underline">
          <Pencil className="h-3 w-3" /> Edit receptionist on customer's behalf
        </button>
      </>
    );
  }

  const set = <K extends keyof AgentPatch>(k: K, v: AgentPatch[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
        You're editing this customer's receptionist. Changes are saved as them and logged in server logs.
      </div>
      <Grid>
        <TextField label="Business name" value={form.business_name ?? ""} onChange={(v) => set("business_name", v)} />
        <TextField label="Industry" value={form.industry ?? ""} onChange={(v) => set("industry", v)} />
        <TextField label="Tone" value={form.tone ?? ""} onChange={(v) => set("tone", v)} />
        <TextField label="Primary goal" value={form.primary_goal ?? ""} onChange={(v) => set("primary_goal", v)} />
        <TextField label="Voice ID" value={form.voice_id ?? ""} onChange={(v) => set("voice_id", v)} />
        <TextField label="Answer mode" value={form.answer_mode ?? ""} onChange={(v) => set("answer_mode", v)} />
        <TextField label="Notify email" value={form.notify_email ?? ""} onChange={(v) => set("notify_email", v)} />
        <TextField label="Notify phone" value={form.notify_phone ?? ""} onChange={(v) => set("notify_phone", v)} />
        <TextField label="Booking link" value={form.booking_link ?? ""} onChange={(v) => set("booking_link", v)} />
        <TextField label="Emergency number" value={form.emergency_number ?? ""} onChange={(v) => set("emergency_number", v)} />
      </Grid>
      <div className="flex gap-6">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!form.is_live} onChange={(e) => set("is_live", e.target.checked)} />
          Live (vs. draft)
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!form.sms_followup_enabled} onChange={(e) => set("sms_followup_enabled", e.target.checked)} />
          SMS follow-up enabled
        </label>
      </div>
      <TextArea label="Greeting" rows={2} value={form.greeting ?? ""} onChange={(v) => set("greeting", v)} />
      <TextArea label="System prompt" rows={8} value={form.system_prompt ?? ""} onChange={(v) => set("system_prompt", v)} />
      <TextArea label="Services" rows={4} value={form.services_text ?? ""} onChange={(v) => set("services_text", v)} />
      <TextArea label="FAQs" rows={6} value={form.faqs_text ?? ""} onChange={(v) => set("faqs_text", v)} />
      <TextArea label="Pricing notes" rows={3} value={form.pricing_notes ?? ""} onChange={(v) => set("pricing_notes", v)} />
      <TextArea label="Escalation triggers" rows={3} value={form.escalation_triggers ?? ""} onChange={(v) => set("escalation_triggers", v)} />

      <div className="flex gap-2 pt-2 border-t border-border">
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            const original = initForm();
            const patch: AgentPatch = {};
            (Object.keys(form) as (keyof AgentPatch)[]).forEach((k) => {
              if (form[k] !== original[k]) (patch as any)[k] = form[k];
            });
            if (Object.keys(patch).length === 0) {
              toast.info("No changes to save.");
              setSaving(false);
              return;
            }
            const ok = await onSave(patch);
            setSaving(false);
            if (ok) setEditing(false);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <X className="h-4 w-4" /> Cancel
        </button>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
      />
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
      />
    </div>
  );
}

function BillingOverrides({ profile, onSave }: { profile: any; onSave: (priceCents: number | null, freeUntil: string | null) => Promise<boolean> }) {
  const initialPrice = profile?.monthly_price_override_cents != null
    ? (profile.monthly_price_override_cents / 100).toFixed(2)
    : "";
  const initialFree = profile?.first_month_free_until
    ? String(profile.first_month_free_until).slice(0, 10)
    : "";
  const [price, setPrice] = useState(initialPrice);
  const [freeUntil, setFreeUntil] = useState(initialFree);
  const [saving, setSaving] = useState(false);
  const dirty = price !== initialPrice || freeUntil !== initialFree;

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">Billing overrides</h4>
        <span className="text-[11px] text-muted-foreground">Applied when Stripe is connected. Leave blank for standard.</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Custom monthly price (USD)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 49.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Free until (date)</label>
          <input
            type="date"
            value={freeUntil}
            onChange={(e) => setFreeUntil(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          disabled={!dirty || saving}
          onClick={async () => {
            setSaving(true);
            const cents = price.trim() === "" ? null : Math.round(parseFloat(price) * 100);
            const free = freeUntil.trim() === "" ? null : new Date(freeUntil + "T00:00:00Z").toISOString();
            await onSave(Number.isFinite(cents as number) ? cents : null, free);
            setSaving(false);
          }}
          className="px-3 py-1.5 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save billing"}
        </button>
      </div>
    </div>
  );
}
