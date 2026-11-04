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