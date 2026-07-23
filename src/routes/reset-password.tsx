import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { AgentFactoryLogo } from "@/components/AgentFactoryLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { resetPasswordWithToken } from "@/lib/password-reset.functions";
import { isPasswordStrong, PASSWORD_REQUIREMENTS_TEXT } from "@/lib/password-strength";
import { PasswordStrength } from "@/components/PasswordStrength";

const resetSearchSchema = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/reset-password")({
  validateSearch: resetSearchSchema,
  head: () => ({
    meta: [
      { title: "Set new password — Ask Janice" },
      { name: "description", content: "Choose a new password for your Ask Janice account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token } = Route.useSearch();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return toast.error("Missing reset token.");
    if (pwd.length < 8) return toast.error("Password must be at least 8 characters.");
    if (pwd !== confirm) return toast.error("Passwords do not match.");
    setBusy(true);
    try {
      await resetPasswordWithToken({ data: { token, password: pwd } });
      toast.success("Password updated. Please sign in.");
      navigate({ to: "/auth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex justify-center">
          <AgentFactoryLogo imgClassName="h-28 w-auto object-contain" />
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-foreground">Choose a new password</h1>
          {!token ? (
            <p className="mt-4 text-sm text-muted-foreground">
              This link is missing its reset token. Please open the page using the link from your
              password-reset email, or{" "}
              <Link to="/forgot-password" className="underline">
                request a new one
              </Link>
              .
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="pwd">New password</Label>
                <Input id="pwd" type="password" required minLength={8} value={pwd} onChange={(e) => setPwd(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="cpwd">Confirm password</Label>
                <Input id="cpwd" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
