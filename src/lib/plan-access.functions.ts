import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPlanAccess = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { planEnvironment } = await import("@/server/plan-access.server");
  const env = planEnvironment();
  const { data: priceId, error } = await context.supabase.rpc("account_plan_id", { p_user: context.userId, p_env: env });
  if (error) throw new Error(error.message);
  const { data: sub } = await context.supabase.from("subscriptions").select("current_period_start,current_period_end").eq("user_id", context.userId).eq("environment", env).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const now = new Date();
  const start = sub?.current_period_start ?? new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString();
  const end = sub?.current_period_end ?? new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1)).toISOString();
  const { data: ledger, error: usageError } = await context.supabase.from("call_allowance_ledger").select("actual_seconds,reserved_seconds").eq("user_id", context.userId).eq("environment", env).eq("period_start",start);
  if (usageError) throw new Error(usageError.message);
  return { priceId, usedSeconds: (ledger ?? []).reduce((n,r) => n + (r.actual_seconds ?? r.reserved_seconds),0), resetsAt: end };
});