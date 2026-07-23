import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AgentFactoryLogo } from "@/components/AgentFactoryLogo";
import { Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { getInvitationByToken, acceptInvitationAndSignup } from "@/lib/invitations.functions";
import { supabase } from "@/integrations/supabase/client";
import { isPasswordStrong, PASSWORD_REQUIREMENTS_TEXT } from "@/lib/password-strength";
import { PasswordStrength } from "@/components/PasswordStrength";

const searchSchema = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/auth_/invite")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Accept your invite — Ask Janice" },
      { name: "description", content: "Complete your Ask Janice account setup." },
    ],
  }),
  component: InvitePage,
});

type State =
  | { kind: "loading" }
  | { kind: "invalid"; reason: string }
  | { kind: "ready"; email: string; trialDays: number | null }
  | { kind: "creating" }
  | { kind: "done" };

function InvitePage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", reason: "This link is missing its invite token." });
      return;
    }
    getInvitationByToken({ data: { token } }).then((res) => {
      if (!res.valid) {
        const map: Record<string, string> = {
          not_found: "We couldn't find this invitation. Check with whoever sent it to you.",
          revoked: "This invitation has been revoked. Reach out for a new one.",
          already_used: "This invitation has already been used. Please sign in instead.",
          expired: "This invitation has expired. Reach out for a new one.",
        };
        setState({ kind: "invalid", reason: map[res.reason] ?? "Invalid invite." });
      } else {
        setState({ kind: "ready", email: res.invitation.email, trialDays: res.invitation.trialDays });
      }
    });
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.kind !== "ready" || !token) return;
    if (!isPasswordStrong(password)) {
      toast.error(PASSWORD_REQUIREMENTS_TEXT);
      return;
    }
    const email = state.email;
    const trialDays = state.trialDays;
    setState({ kind: "creating" });
    const res = await acceptInvitationAndSignup({
      data: { token, password, displayName: displayName.trim() },
    });
    if (!res.success) {
      toast.error(res.error);
      setState({ kind: "ready", email, trialDays });
      return;
    }
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: res.email,
      password,
    });
    if (signInErr) {
      toast.error("Account created, but sign-in failed. Try signing in manually.");
      navigate({ to: "/auth" });
      return;
    }
    setState({ kind: "done" });
    setTimeout(() => navigate({ to: "/dashboard" }), 800);
  };

  const trialLabel =
    state.kind === "ready" || state.kind === "creating"
      ? state.kind === "ready"
        ? state.trialDays == null
          ? "Unlimited free trial"
          : `${state.trialDays}-day free trial`
        : ""
      : "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex justify-center">
          <AgentFactoryLogo imgClassName="h-28 w-auto object-contain" />
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {state.kind === "loading" && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Checking your invitation…
            </div>
          )}

          {state.kind === "invalid" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <span className="font-semibold">Invitation invalid</span>
              </div>
              <p className="text-sm text-muted-foreground">{state.reason}</p>
              <Link to="/auth" className="inline-block text-sm underline">
                Go to sign in
              </Link>
            </div>
          )}

          {state.kind === "done" && (
            <div className="flex items-center gap-3 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              <div>
                <div className="font-semibold">Welcome to Ask Janice!</div>
                <div className="text-xs text-muted-foreground">Taking you to your dashboard…</div>
              </div>
            </div>
          )}

          {(state.kind === "ready" || state.kind === "creating") && (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h1 className="font-display text-xl font-semibold">Create your account</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {trialLabel} · No credit card required.
                </p>
              </div>
              <div>
                <Label htmlFor="invite-email">Email</Label>
                <Input id="invite-email" type="email" value={state.kind === "ready" ? state.email : ""} disabled />
              </div>
              <div>
                <Label htmlFor="invite-name">Your name</Label>
                <Input
                  id="invite-name"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="invite-password">Create a password</Label>
                <div className="relative">
                  <Input
                    id="invite-password"
                    type={show ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    aria-label={show ? "Hide password" : "Show password"}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordStrength password={password} />
              </div>
              <Button type="submit" className="w-full" disabled={state.kind === "creating"}>
                {state.kind === "creating" ? "Creating your account…" : "Create account & start trial"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
