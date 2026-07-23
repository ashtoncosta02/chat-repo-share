import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail } from "@/server/email.server";
import { renderInvitationEmail } from "@/server/email-templates.server";

const SITE_URL = "https://www.askjanice.net";

async function requireAdmin(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return { error: "Unauthorized" as const };
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return { error: "Forbidden" as const };
  return { userId: data.user.id, email: data.user.email ?? null };
}

function generateToken(): string {
  // URL-safe random token, 32 bytes → base64url
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─────────────────────────────────────────────────────────────
// Admin: list all invitations + trialing users
// ─────────────────────────────────────────────────────────────

export const adminListInvitations = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ accessToken: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const [invitesRes, trialingRes] = await Promise.all([
      supabaseAdmin
        .from("account_invitations")
        .select("id, email, token, trial_days, status, accepted_user_id, accepted_at, expires_at, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("profiles")
        .select("user_id, email, display_name, trial_ends_at, trial_unlimited, billing_status, created_at")
        .in("billing_status", ["trial", "trial_expired"])
        .order("created_at", { ascending: false }),
    ]);

    return {
      success: true as const,
      invitations: invitesRes.data ?? [],
      trialingUsers: trialingRes.data ?? [],
      siteUrl: SITE_URL,
    };
  });

// ─────────────────────────────────────────────────────────────
// Admin: create + send an invitation
// ─────────────────────────────────────────────────────────────

export const adminCreateInvitation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        accessToken: z.string().min(1),
        email: z.string().email().max(255),
        // null = unlimited trial
        trialDays: z.number().int().min(1).max(3650).nullable(),
        sendEmail: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const email = data.email.trim().toLowerCase();

    // If a user already exists with this email, reject
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .ilike("email", email)
      .maybeSingle();
    if (existingProfile) {
      return { success: false as const, error: "A user with that email already exists. Use the trial controls on their profile instead." };
    }

    // Revoke any existing pending invites for this email
    await supabaseAdmin
      .from("account_invitations")
      .update({ status: "revoked" })
      .ilike("email", email)
      .eq("status", "pending");

    const token = generateToken();
    const { data: inv, error: insErr } = await supabaseAdmin
      .from("account_invitations")
      .insert({
        email,
        token,
        trial_days: data.trialDays,
        invited_by: auth.userId,
        status: "pending",
      })
      .select("id, token, email, trial_days, expires_at")
      .single();

    if (insErr || !inv) {
      return { success: false as const, error: insErr?.message ?? "Failed to create invitation" };
    }

    const inviteUrl = `${SITE_URL}/auth/invite?token=${inv.token}`;

    if (data.sendEmail) {
      const trialLabel = inv.trial_days == null ? "unlimited free trial" : `${inv.trial_days}-day free trial`;
      const rendered = renderInvitationEmail({
        toEmail: email,
        inviteUrl,
        trialLabel,
      });
      await sendEmail({
        to: email,
        subject: rendered.subject,
        html: rendered.html,
        replyTo: auth.email ?? undefined,
      });
    }

    return { success: true as const, invitation: inv, inviteUrl };
  });

// ─────────────────────────────────────────────────────────────
// Admin: revoke / resend / delete
// ─────────────────────────────────────────────────────────────

export const adminRevokeInvitation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ accessToken: z.string().min(1), invitationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };
    const { error } = await supabaseAdmin
      .from("account_invitations")
      .update({ status: "revoked" })
      .eq("id", data.invitationId);
    if (error) return { success: false as const, error: error.message };
    return { success: true as const };
  });

export const adminResendInvitation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ accessToken: z.string().min(1), invitationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const { data: inv } = await supabaseAdmin
      .from("account_invitations")
      .select("email, token, trial_days, status, expires_at")
      .eq("id", data.invitationId)
      .maybeSingle();
    if (!inv) return { success: false as const, error: "Invitation not found" };
    if (inv.status !== "pending") return { success: false as const, error: "Invitation is not pending" };

    // Push expiry out 30 days from now so it's fresh
    const newExpiry = new Date(Date.now() + 30 * 86400000).toISOString();
    await supabaseAdmin.from("account_invitations").update({ expires_at: newExpiry }).eq("id", data.invitationId);

    const inviteUrl = `${SITE_URL}/auth/invite?token=${inv.token}`;
    const trialLabel = inv.trial_days == null ? "unlimited free trial" : `${inv.trial_days}-day free trial`;
    const rendered = renderInvitationEmail({ toEmail: inv.email, inviteUrl, trialLabel });
    await sendEmail({
      to: inv.email,
      subject: rendered.subject,
      html: rendered.html,
      replyTo: auth.email ?? undefined,
    });
    return { success: true as const };
  });

export const adminDeleteInvitation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ accessToken: z.string().min(1), invitationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };
    const { error } = await supabaseAdmin.from("account_invitations").delete().eq("id", data.invitationId);
    if (error) return { success: false as const, error: error.message };
    return { success: true as const };
  });

// ─────────────────────────────────────────────────────────────
// Admin: update a user's trial / billing status
// (does NOT touch any of their business data — only the gate)
// ─────────────────────────────────────────────────────────────

export const adminSetUserTrial = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        accessToken: z.string().min(1),
        userId: z.string().uuid(),
        // 'extend_days' → set trial_ends_at = now + N days, unlimited=false, status='trial'
        // 'unlimited'   → unlimited=true, trial_ends_at=null, status='trial'
        // 'end_trial'   → status='trial_expired' (they'll see the pay banner). Data preserved.
        // 'activate'    → status='active' (fully paid / comped, no gate). Data preserved.
        action: z.enum(["extend_days", "unlimited", "end_trial", "activate"]),
        days: z.number().int().min(1).max(3650).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    if (data.action === "extend_days") {
      if (!data.days) return { success: false as const, error: "Days required" };
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          trial_ends_at: new Date(Date.now() + data.days * 86400000).toISOString(),
          trial_unlimited: false,
          billing_status: "trial",
        })
        .eq("user_id", data.userId);
      if (error) return { success: false as const, error: error.message };
    } else if (data.action === "unlimited") {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ trial_ends_at: null, trial_unlimited: true, billing_status: "trial" })
        .eq("user_id", data.userId);
      if (error) return { success: false as const, error: error.message };
    } else if (data.action === "end_trial") {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ billing_status: "trial_expired", trial_unlimited: false })
        .eq("user_id", data.userId);
      if (error) return { success: false as const, error: error.message };
    } else if (data.action === "activate") {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ billing_status: "active" })
        .eq("user_id", data.userId);
      if (error) return { success: false as const, error: error.message };
    }
    return { success: true as const };
  });

// ─────────────────────────────────────────────────────────────
// PUBLIC: look up an invitation by token (used on the invite signup page)
// ─────────────────────────────────────────────────────────────

export const getInvitationByToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(10).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { data: inv } = await supabaseAdmin
      .from("account_invitations")
      .select("id, email, status, trial_days, expires_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!inv) return { valid: false as const, reason: "not_found" as const };
    if (inv.status === "revoked") return { valid: false as const, reason: "revoked" as const };
    if (inv.status === "accepted") return { valid: false as const, reason: "already_used" as const };
    if (new Date(inv.expires_at).getTime() < Date.now()) return { valid: false as const, reason: "expired" as const };

    return {
      valid: true as const,
      invitation: { id: inv.id, email: inv.email, trialDays: inv.trial_days },
    };
  });

// ─────────────────────────────────────────────────────────────
// PUBLIC: accept an invitation and create the account
// (bypasses the "signups closed" gate because we control it server-side)
// ─────────────────────────────────────────────────────────────

export const acceptInvitationAndSignup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().min(10).max(200),
        password: z.string().min(6).max(200),
        displayName: z.string().trim().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: inv } = await supabaseAdmin
      .from("account_invitations")
      .select("id, email, status, trial_days, expires_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!inv) return { success: false as const, error: "Invitation not found" };
    if (inv.status !== "pending") return { success: false as const, error: "Invitation is no longer valid" };
    if (new Date(inv.expires_at).getTime() < Date.now()) return { success: false as const, error: "Invitation has expired" };

    // Create the user via admin API (bypasses the "disable signups" auth setting)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: inv.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.displayName },
    });

    if (createErr || !created.user) {
      return { success: false as const, error: createErr?.message ?? "Failed to create account" };
    }

    const userId = created.user.id;

    // The handle_new_user trigger creates the base profile row. Now apply the
    // trial settings on top of it.
    await supabaseAdmin
      .from("profiles")
      .update({
        display_name: data.displayName,
        billing_status: "trial",
        trial_unlimited: inv.trial_days == null,
        trial_ends_at:
          inv.trial_days == null ? null : new Date(Date.now() + inv.trial_days * 86400000).toISOString(),
      })
      .eq("user_id", userId);

    // Mark the invitation accepted
    await supabaseAdmin
      .from("account_invitations")
      .update({ status: "accepted", accepted_user_id: userId, accepted_at: new Date().toISOString() })
      .eq("id", inv.id);

    return { success: true as const, email: inv.email };
  });
