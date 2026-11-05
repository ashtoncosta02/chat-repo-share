import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { planForPrice } from "@/lib/plans";

export function planEnvironment(): "live" | "sandbox" {
  const token = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
  if (token?.startsWith("pk_test_")) return "sandbox";
  if (token?.startsWith("pk_live_")) return "live";
  throw new Error("Payments are not configured.");
}
export async function accountPlan(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("account_plan_id", { p_user: userId, p_env: planEnvironment() });
  if (error) throw new Error(error.message);
  return { priceId: typeof data === "string" ? data : null, plan: planForPrice(data) };
}

/**
 * The plan a receptionist should run under, for what callers, website visitors
 * and customer texts experience. Checks the live subscription first, then
 * sandbox — the same order as the enforce_scenario_plan database trigger.
 *
 * Deliberately does NOT use planEnvironment(): the -dev deployment resolves to
 * sandbox while serving real customers whose subscriptions are live, so
 * planEnvironment() would wrongly report "no plan" for them.
 */
export async function receptionistPlan(userId: string) {
  for (const env of ["live", "sandbox"] as const) {
    const { data, error } = await supabaseAdmin.rpc("account_plan_id", { p_user: userId, p_env: env });
    if (error) throw new Error(error.message);
    const plan = planForPrice(typeof data === "string" ? data : null);
    if (plan) return plan;
  }
  return null;
}
