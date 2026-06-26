import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const APP_URL = "https://www.askjanice.net";
const TOKEN_TTL_MINUTES = 60;

function randomToken(): string {
  // 32 random bytes → 64-char hex
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().email() }).parse(input),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendEmail } = await import("@/server/email.server");

    // Look up the user by email. We always respond success to avoid leaking
    // whether an account exists.
    let userId: string | null = null;
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .ilike("email", email)
        .maybeSingle();
      if (profile?.user_id) userId = profile.user_id as string;
    } catch (e) {
      console.error("requestPasswordReset: profile lookup failed", e);
    }

    if (userId) {
      const token = randomToken();
      const tokenHash = await sha256Hex(token);
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000).toISOString();
      const { error: insertErr } = await supabaseAdmin
        .from("password_reset_tokens")
        .insert({ token_hash: tokenHash, user_id: userId, email, expires_at: expiresAt });
      if (insertErr) {
        console.error("requestPasswordReset: insert failed", insertErr);
      } else {
        const link = `${APP_URL}/reset-password?token=${token}`;
        const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f3ef;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
<tr><td style="padding:24px 32px;border-bottom:1px solid #eee;font-size:18px;font-weight:600;color:#1a1a1a;">Ask Janice</td></tr>
<tr><td style="padding:28px 32px;font-size:15px;line-height:1.55;">
<p style="margin:0 0 16px;">Hi there,</p>
<p style="margin:0 0 16px;">We received a request to reset the password for your Ask Janice account. Click the button below to choose a new password. This link expires in ${TOKEN_TTL_MINUTES} minutes.</p>
<p style="margin:24px 0;"><a href="${link}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">Reset your password</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#666;">Or paste this link into your browser:</p>
<p style="margin:0 0 16px;font-size:13px;word-break:break-all;"><a href="${link}" style="color:#1a1a1a;">${link}</a></p>
<p style="margin:0;font-size:13px;color:#666;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #eee;font-size:12px;color:#888;">Ask Janice · <a href="https://askjanice.net" style="color:#888;">askjanice.net</a></td></tr>
</table></td></tr></table></body></html>`;
        await sendEmail({
          to: email,
          subject: "Reset your Ask Janice password",
          html,
          text: `Reset your Ask Janice password by opening this link (expires in ${TOKEN_TTL_MINUTES} minutes):\n\n${link}\n\nIf you didn't request this, ignore this email.`,
        });
      }
    }

    return { ok: true as const };
  });

export const resetPasswordWithToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ token: z.string().min(32), password: z.string().min(8).max(128) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenHash = await sha256Hex(data.token);
    const { data: row, error: selErr } = await supabaseAdmin
      .from("password_reset_tokens")
      .select("user_id, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (selErr) throw new Error("Could not verify reset link. Please try again.");
    if (!row) throw new Error("This reset link is invalid or has already been used.");
    if (row.used_at) throw new Error("This reset link has already been used. Request a new one.");
    if (new Date(row.expires_at as string).getTime() < Date.now()) {
      throw new Error("This reset link has expired. Request a new one.");
    }
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
      row.user_id as string,
      { password: data.password },
    );
    if (updErr) throw new Error(updErr.message);
    await supabaseAdmin
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token_hash", tokenHash);
    return { ok: true as const };
  });
