import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { deleteOwnAccount } from "@/lib/account.functions";
import { Mail, KeyRound, CreditCard, CheckCircle2, AlertCircle, Trash2, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { isPasswordStrong, PASSWORD_REQUIREMENTS_TEXT } from "@/lib/password-strength";
import { PasswordStrength } from "@/components/PasswordStrength";

export const Route = createFileRoute("/dashboard/account")({
  head: () => ({
    meta: [
      { title: "Account — Ask Janice" },
      { name: "description", content: "Manage your account, email, password, and billing." },
    ],
  }),
  component: AccountPage,
});

type Msg = { type: "success" | "error"; text: string } | null;

function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [newEmail, setNewEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<Msg>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState<Msg>(null);
  const [pwdBusy, setPwdBusy] = useState(false);

  async function updateEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailMsg(null);
    if (!newEmail || newEmail === user?.email) {
      setEmailMsg({ type: "error", text: "Enter a new email address." });
      return;
    }
    setEmailBusy(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailBusy(false);
    if (error) setEmailMsg({ type: "error", text: error.message });
    else {
      setEmailMsg({
        type: "success",
        text: "Confirmation link sent. Check both your old and new inboxes to confirm the change.",
      });
      setNewEmail("");
    }
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (!isPasswordStrong(newPwd)) {
      setPwdMsg({ type: "error", text: PASSWORD_REQUIREMENTS_TEXT });
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: "error", text: "Passwords do not match." });
      return;
    }
    setPwdBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setPwdBusy(false);
    if (error) setPwdMsg({ type: "error", text: error.message });
    else {
      setPwdMsg({ type: "success", text: "Password updated." });
      setNewPwd("");
      setConfirmPwd("");
    }
  }

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <PageHeader title="Account" description="Manage your sign-in details and billing." />

      {/* Profile */}
      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Profile</h2>
        <dl className="mt-4 text-sm">
          <div className="flex justify-between py-2 border-b border-border">
            <dt className="text-muted-foreground">Current email</dt>
            <dd className="text-foreground font-medium">{user?.email}</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-muted-foreground">User ID</dt>
            <dd className="text-foreground font-mono text-xs truncate max-w-[260px]">{user?.id}</dd>
          </div>
        </dl>
      </section>

      {/* Email */}
      <section id="email" className="mt-6 rounded-xl border border-border bg-card p-6 scroll-mt-20">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-foreground" />
          <h2 className="text-base font-semibold text-foreground">Change email</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          We'll email a confirmation link to your new address before the change takes effect.
        </p>
        <form onSubmit={updateEmail} className="mt-4 space-y-3">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="new@example.com"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
          />
          {emailMsg && <FormMessage msg={emailMsg} />}
          <button
            type="submit"
            disabled={emailBusy}
            className="rounded-lg bg-[var(--gold)] text-[var(--gold-foreground)] px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {emailBusy ? "Sending…" : "Update email"}
          </button>
        </form>
      </section>

      {/* Password */}
      <section id="password" className="mt-6 rounded-xl border border-border bg-card p-6 scroll-mt-20">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-foreground" />
          <h2 className="text-base font-semibold text-foreground">Change password</h2>
        </div>
        <form onSubmit={updatePassword} className="mt-4 space-y-3">
          <input
            type="password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            placeholder="New password (min 8 characters)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
          />
          <PasswordStrength password={newPwd} />
          <input
            type="password"
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            placeholder="Confirm new password"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
          />
          {pwdMsg && <FormMessage msg={pwdMsg} />}
          <button
            type="submit"
            disabled={pwdBusy}
            className="rounded-lg bg-[var(--gold)] text-[var(--gold-foreground)] px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {pwdBusy ? "Updating…" : "Update password"}
          </button>
        </form>
      </section>

      {/* Subscription */}
      <BillingSection />


      {/* Support */}
      <section id="support" className="mt-6 rounded-xl border border-border bg-card p-6 scroll-mt-20">
        <div className="flex items-center gap-2">
          <LifeBuoy className="h-4 w-4 text-foreground" />
          <h2 className="text-base font-semibold text-foreground">Help &amp; support</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Questions about your account, billing, or your receptionist? Open a ticket and we'll get
          back to you fast.
        </p>
        <a
          href="/dashboard/help"
          className="mt-4 inline-block rounded-lg bg-[var(--gold)] text-[var(--gold-foreground)] px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          Open a support ticket
        </a>
      </section>

      {/* Danger zone */}
      <section id="danger" className="mt-6 rounded-xl border border-destructive/40 bg-card p-6 scroll-mt-20">
        <div className="flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-destructive" />
          <h2 className="text-base font-semibold text-destructive">Delete account</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Permanently delete your account, your receptionist, conversations, leads, bookings, and
          connected phone numbers. This cannot be undone.
        </p>
        <DeleteAccountButton onDone={async () => { await signOut(); navigate({ to: "/" }); }} />
      </section>
    </div>
  );
}

function DeleteAccountButton({ onDone }: { onDone: () => Promise<void> | void }) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const canDelete = confirm === "DELETE";

  async function handleDelete() {
    if (!canDelete) return;
    setBusy(true);
    try {
      await deleteOwnAccount({ data: { confirm: "DELETE" } });
      toast.success("Account deleted.");
      await onDone();
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Could not delete account.");
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <label className="block text-xs text-muted-foreground">
        Type <span className="font-mono font-semibold">DELETE</span> to confirm
      </label>
      <input
        type="text"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="DELETE"
        className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
      />
      <button
        type="button"
        onClick={handleDelete}
        disabled={!canDelete || busy}
        className="rounded-lg bg-destructive text-destructive-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Permanently delete my account"}
      </button>
    </div>
  );
}

function FormMessage({ msg }: { msg: NonNullable<Msg> }) {
  const isOk = msg.type === "success";
  const Icon = isOk ? CheckCircle2 : AlertCircle;
  return (
    <div
      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
        isOk
          ? "bg-green-50 text-green-800 border border-green-200"
          : "bg-red-50 text-red-800 border border-red-200"
      }`}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{msg.text}</span>
    </div>
  );
}
