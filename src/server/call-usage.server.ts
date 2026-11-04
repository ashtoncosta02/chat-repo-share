import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { planEnvironment } from "@/server/plan-access.server";

export async function reserveAgentCall(agentId: string, callKey: string) {
  const { data: agent, error: agentError } = await supabaseAdmin.from("agents").select("user_id").eq("elevenlabs_agent_id", agentId).maybeSingle();
  if (agentError || !agent) throw new Error("Receptionist not found.");
  const { data, error } = await supabaseAdmin.rpc("reserve_call_allowance", { p_user: agent.user_id, p_env: planEnvironment(), p_call_key: callKey, p_max_seconds: 600 });
  if (error) throw new Error(error.message);
  const result = data as { seconds?: number; reservation_id?: string; error?: string } | null;
  if (!result?.seconds || !result.reservation_id) throw new Error(result?.error || "Monthly call allowance reached.");
  return { seconds: result.seconds, reservationId: result.reservation_id };
}

export async function finishAgentCall(userId: string, conversationId: string, seconds: number, reservationId?: string) {
  const { error } = await supabaseAdmin.rpc("finalize_call_allowance", { p_user: userId, p_env: planEnvironment(), p_conversation_id: conversationId, p_seconds: seconds, ...(reservationId ? { p_reservation: reservationId } : {}) });
  if (error) throw new Error(error.message);
}

export async function releaseFailedReservation(reservationId: string) {
  const { error } = await supabaseAdmin.from("call_allowance_ledger").update({ actual_seconds:0,finalized_at:new Date().toISOString() }).eq("id",reservationId).is("finalized_at",null);
  if (error) throw new Error(error.message);
}

// Agent-scoped credential; never send the application key to the provider.
export async function callAllowanceCredential(agentId: string) {
  const secret = process.env.LOVABLE_API_KEY;
  if (!secret) throw new Error("Call allowance authentication is not configured.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`call-allowance:${agentId}`));
  return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2,"0")).join("");
}
const ALLOWANCE_THRESHOLDS = [100, 80] as const;

/**
 * After a real call is finalized, email the owner once per billing period when
 * usage crosses 80% and 100% of the plan's minutes. Never throws.
 */
export async function notifyAllowanceThresholds(userId: string): Promise<void> {
  try {
    const env = planEnvironment();
    const { accountPlan } = await import("@/server/plan-access.server");
    const { plan } = await accountPlan(userId);
    if (!plan) return;
    const { data: sub } = await supabaseAdmin.from("subscriptions").select("current_period_start,current_period_end").eq("user_id", userId).eq("environment", env).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const now = new Date();
    const start = sub?.current_period_start ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const end = sub?.current_period_end ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
    const { data: ledger, error } = await supabaseAdmin.from("call_allowance_ledger").select("actual_seconds,reserved_seconds").eq("user_id", userId).eq("environment", env).eq("period_start", start);
    if (error) return;
    const usedSeconds = (ledger ?? []).reduce((n, r) => n + (r.actual_seconds ?? r.reserved_seconds), 0);
    const limitSeconds = plan.callMinutes * 60;
    const pct = (usedSeconds / limitSeconds) * 100;
    const threshold = ALLOWANCE_THRESHOLDS.find((t) => pct >= t);
    if (!threshold) return;

    const { allowRequestStrict } = await import("@/server/rate-limit.server");
    const windowSeconds = Math.max(3600, Math.ceil((new Date(end).getTime() - Date.now()) / 1000) + 86400 * 3);
    if (!(await allowRequestStrict(`allowance-email:${userId}:${start}:${threshold}`, 1, windowSeconds))) return;

    const { data: profile } = await supabaseAdmin.from("profiles").select("email").eq("id", userId).maybeSingle();
    if (!profile?.email) return;
    const usedMinutes = Math.round(usedSeconds / 60);
    const resets = new Date(end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const { sendEmail } = await import("@/server/email.server");
    const { PUBLIC_APP_ORIGIN } = await import("@/lib/app-origin");
    const subject = threshold >= 100
      ? "Your AI Receptionist has reached this month's call minutes"
      : "You've used 80% of this month's call minutes";
    const body = threshold >= 100
      ? `<p>Your receptionist has used all ${plan.callMinutes} call minutes included in your ${plan.name} plan, so it will stop answering calls until your allowance resets on ${resets}.</p>`
      : `<p>Your receptionist has used about ${usedMinutes} of the ${plan.callMinutes} call minutes included in your ${plan.name} plan. Your allowance resets on ${resets}.</p>`;
    await sendEmail({
      to: profile.email,
      subject,
      html: `${body}<p><a href="${PUBLIC_APP_ORIGIN}/dashboard/account">Review your plan</a></p>`,
    });
  } catch (e) {
    console.error("notifyAllowanceThresholds failed", e);
  }
}
