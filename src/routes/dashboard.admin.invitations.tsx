import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  adminListInvitations,
  adminCreateInvitation,
  adminRevokeInvitation,
  adminResendInvitation,
  adminDeleteInvitation,
  adminSetUserTrial,
} from "@/lib/invitations.functions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, ArrowLeft, Mail, Copy, RefreshCw, Trash2, X, Infinity as InfinityIcon, Clock, CheckCircle2, XCircle, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/dashboard/admin/invitations")({
  head: () => ({ meta: [{ title: "Admin · Invitations" }] }),
  component: InvitationsPage,
});

type Data = Awaited<ReturnType<typeof adminListInvitations>>;
type OkData = Extract<Data, { success: true }>;

const TRIAL_PRESETS: { label: string; days: number | null }[] = [
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
  { label: "6 months", days: 180 },
  { label: "Unlimited", days: null },
  { label: "Custom…", days: -1 }, // sentinel
];

function InvitationsPage() {
  const { session } = useAuth();
  const { isAdmin, checked } = useIsAdmin();
  const navigate = useNavigate();
  const [data, setData] = useState<OkData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!session?.access_token) return;
    setLoading(true);
    adminListInvitations({ data: { accessToken: session.access_token } })
      .then((res) => {
        if ("success" in res && res.success) setData(res);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (checked && !isAdmin) navigate({ to: "/dashboard" });
  }, [checked, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin && session?.access_token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, session?.access_token]);

  if (!checked || !isAdmin) return <div className="p-8 text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-full">
      <PageHeader
        title="Free trial invitations"
        description="Invite people to try Janice free. Their data is preserved forever — you can flip them to paid later without losing anything they've built."
        breadcrumb={
          <Link to="/dashboard/admin" className="inline-flex items-center gap-1.5 hover:text-foreground">
            <Shield className="h-3.5 w-3.5" /> Admin <ArrowLeft className="h-3 w-3 rotate-180" /> Invitations
          </Link>
        }
      />

      <div className="p-4 md:p-8 space-y-8 max-w-6xl">
        <InviteForm accessToken={session?.access_token} onCreated={load} siteUrl={data?.siteUrl ?? ""} />

        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <Mail className="h-3.5 w-3.5" /> Invitations
          </h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading…</div>
            ) : !data || data.invitations.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center">
                No invitations yet. Send one above.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.invitations.map((inv) => (
                  <InvitationRow
                    key={inv.id}
                    inv={inv}
                    accessToken={session?.access_token}
                    siteUrl={data.siteUrl}
                    onChange={load}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" /> Trialing customers
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Extend trials, switch to unlimited, or end a trial (turns on the "please pay" state — their data is
            preserved). "Activate" clears the gate entirely for comped/paying users.
          </p>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {!data || data.trialingUsers.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center">No customers on a trial right now.</div>
            ) : (
              <div className="divide-y divide-border">
                {data.trialingUsers.map((u) => (
                  <TrialingUserRow key={u.user_id} user={u} accessToken={session?.access_token} onChange={load} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function InviteForm({
  accessToken,
  onCreated,
  siteUrl,
}: {
  accessToken: string | undefined;
  onCreated: () => void;
  siteUrl: string;
}) {
  const [email, setEmail] = useState("");
  const [preset, setPreset] = useState<string>("30");
  const [customDays, setCustomDays] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    let trialDays: number | null;
    if (preset === "unlimited") trialDays = null;
    else if (preset === "custom") {
      const n = parseInt(customDays, 10);
      if (!Number.isFinite(n) || n < 1) {
        toast.error("Enter a valid number of days.");
        return;
      }
      trialDays = n;
    } else {
      trialDays = parseInt(preset, 10);
    }

    setSubmitting(true);
    try {
      const res = await adminCreateInvitation({
        data: { accessToken, email: email.trim(), trialDays, sendEmail: true },
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Invitation sent to ${email}.`);
      setLastLink(res.inviteUrl);
      setEmail("");
      onCreated();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5 md:p-6">
      <h2 className="font-semibold text-foreground mb-1">Send a new invitation</h2>
      <p className="text-sm text-muted-foreground mb-4">
        They'll get an email with a link to set up their account. You can pick how long their free trial lasts.
      </p>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_180px_auto] items-end">
        <div>
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            required
            placeholder="person@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label>Trial length</Label>
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">1 week</SelectItem>
              <SelectItem value="14">2 weeks</SelectItem>
              <SelectItem value="30">1 month</SelectItem>
              <SelectItem value="90">3 months</SelectItem>
              <SelectItem value="180">6 months</SelectItem>
              <SelectItem value="unlimited">Unlimited</SelectItem>
              <SelectItem value="custom">Custom days…</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send invitation"}
        </Button>
        {preset === "custom" && (
          <div className="sm:col-span-3">
            <Label htmlFor="custom-days">Custom trial length (days)</Label>
            <Input
              id="custom-days"
              type="number"
              min={1}
              max={3650}
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              className="max-w-[200px]"
            />
          </div>
        )}
      </form>
      {lastLink && (
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-xs">
          <div className="font-medium text-foreground mb-1">Invite link (also emailed):</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all">{lastLink}</code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(lastLink);
                toast.success("Link copied");
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy
            </Button>
          </div>
        </div>
      )}
      {siteUrl && (
        <p className="mt-3 text-xs text-muted-foreground">
          Links resolve to <code>{siteUrl}/auth/invite?token=…</code>
        </p>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────

function InvitationRow({
  inv,
  accessToken,
  siteUrl,
  onChange,
}: {
  inv: OkData["invitations"][number];
  accessToken: string | undefined;
  siteUrl: string;
  onChange: () => void;
}) {
  const url = `${siteUrl}/auth/invite?token=${inv.token}`;
  const trialLabel = inv.trial_days == null ? "Unlimited" : `${inv.trial_days} days`;

  const statusPill = (() => {
    if (inv.status === "accepted")
      return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5"><CheckCircle2 className="h-3 w-3" />Accepted</span>;
    if (inv.status === "revoked")
      return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 text-xs px-2 py-0.5"><XCircle className="h-3 w-3" />Revoked</span>;
    if (new Date(inv.expires_at).getTime() < Date.now())
      return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 text-xs px-2 py-0.5"><Clock className="h-3 w-3" />Expired</span>;
    return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 text-xs px-2 py-0.5"><Mail className="h-3 w-3" />Pending</span>;
  })();

  const revoke = async () => {
    if (!accessToken) return;
    if (!confirm("Revoke this invitation? The link will stop working.")) return;
    const r = await adminRevokeInvitation({ data: { accessToken, invitationId: inv.id } });
    if (r.success) { toast.success("Revoked"); onChange(); } else toast.error(r.error);
  };
  const resend = async () => {
    if (!accessToken) return;
    const r = await adminResendInvitation({ data: { accessToken, invitationId: inv.id } });
    if (r.success) { toast.success("Invitation re-sent"); onChange(); } else toast.error(r.error);
  };
  const del = async () => {
    if (!accessToken) return;
    if (!confirm("Delete this invitation record permanently?")) return;
    const r = await adminDeleteInvitation({ data: { accessToken, invitationId: inv.id } });
    if (r.success) { toast.success("Deleted"); onChange(); } else toast.error(r.error);
  };

  return (
    <div className="px-5 py-3 flex items-center gap-4 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground truncate">{inv.email}</div>
        <div className="text-xs text-muted-foreground">
          Trial: {trialLabel} · Sent {new Date(inv.created_at).toLocaleDateString()} · Expires{" "}
          {new Date(inv.expires_at).toLocaleDateString()}
        </div>
      </div>
      {statusPill}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-1.5 rounded hover:bg-muted" aria-label="Actions">
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              navigator.clipboard.writeText(url);
              toast.success("Link copied");
            }}
          >
            <Copy className="h-4 w-4 mr-2" /> Copy invite link
          </DropdownMenuItem>
          {inv.status === "pending" && (
            <DropdownMenuItem onClick={resend}>
              <RefreshCw className="h-4 w-4 mr-2" /> Resend email
            </DropdownMenuItem>
          )}
          {inv.status === "pending" && (
            <DropdownMenuItem onClick={revoke}>
              <X className="h-4 w-4 mr-2" /> Revoke
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={del} className="text-red-600 focus:text-red-600">
            <Trash2 className="h-4 w-4 mr-2" /> Delete record
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function TrialingUserRow({
  user,
  accessToken,
  onChange,
}: {
  user: OkData["trialingUsers"][number];
  accessToken: string | undefined;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [extendDays, setExtendDays] = useState("30");

  const run = async (action: "extend_days" | "unlimited" | "end_trial" | "activate", days?: number) => {
    if (!accessToken) return;
    setBusy(true);
    try {
      const r = await adminSetUserTrial({ data: { accessToken, userId: user.user_id, action, days } });
      if (r.success) {
        toast.success("Updated");
        onChange();
      } else toast.error(r.error);
    } finally {
      setBusy(false);
    }
  };

  const statusPill = user.trial_unlimited ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 text-violet-700 text-xs px-2 py-0.5">
      <InfinityIcon className="h-3 w-3" /> Unlimited trial
    </span>
  ) : user.billing_status === "trial_expired" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 text-xs px-2 py-0.5">
      <XCircle className="h-3 w-3" /> Trial ended
    </span>
  ) : user.trial_ends_at ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 text-xs px-2 py-0.5">
      <Clock className="h-3 w-3" /> Ends {new Date(user.trial_ends_at).toLocaleDateString()}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground text-xs px-2 py-0.5">
      Trial (no end date)
    </span>
  );

  return (
    <div className="px-5 py-4 flex items-start gap-4 flex-wrap">
      <div className="min-w-0 flex-1">
        <Link
          to="/dashboard/admin/users/$userId"
          params={{ userId: user.user_id }}
          className="text-sm font-medium text-foreground hover:underline"
        >
          {user.display_name || user.email}
        </Link>
        <div className="text-xs text-muted-foreground truncate">{user.email}</div>
        <div className="mt-1">{statusPill}</div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          type="number"
          value={extendDays}
          onChange={(e) => setExtendDays(e.target.value)}
          className="w-20 h-8"
          min={1}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => run("extend_days", parseInt(extendDays, 10))}
        >
          Extend
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run("unlimited")}>
          Make unlimited
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (!confirm("End trial? Their data is preserved — they'll just see a 'please pay' state until you activate them.")) return;
            run("end_trial");
          }}
        >
          End trial
        </Button>
        <Button size="sm" disabled={busy} onClick={() => run("activate")}>
          Activate (paid)
        </Button>
      </div>
    </div>
  );
}
