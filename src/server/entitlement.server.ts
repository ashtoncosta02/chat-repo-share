import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const NOT_ENTITLED_MESSAGE =
  "Your plan has ended. Restart your plan from the dashboard to keep using this feature.";

function subscriptionActive(sub: {
  status: string | null;
  current_period_end: string | null;
}): boolean {
  const end = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const notExpired = end === null || end > Date.now();
  if (sub.status && ["active", "trialing", "past_due"].includes(sub.status)) return notExpired;
  if (sub.status === "canceled") return end !== null && end > Date.now();
  return false;
}

/**
 * Server-side paywall check. Mirrors the dashboard SubscriptionGate rules so
 * cost-incurring server functions can't be called by a lapsed account.
 */
export async function isEntitled(userId: string): Promise<boolean> {
  // Admins always keep access.
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (roleRow) return true;

  const { data: subs } = await supabaseAdmin
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);
  if ((subs ?? []).some((s) => subscriptionActive(s as never))) return true;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("billing_status, trial_unlimited, trial_ends_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return false;
  if (profile.trial_unlimited) return true;
  if (profile.billing_status === "trial") {
    return !profile.trial_ends_at || new Date(profile.trial_ends_at).getTime() > Date.now();
  }
  return false;
}

/** Convenience wrapper returning the standard error shape used by server fns. */
export async function requireEntitlement(
  userId: string,
): Promise<{ error: string } | null> {
  return (await isEntitled(userId)) ? null : { error: NOT_ENTITLED_MESSAGE };
}
