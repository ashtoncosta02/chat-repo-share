import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Guard for the /api/public/hooks/* maintenance endpoints.
 *
 * Accepts either:
 *  - the database-generated token in `X-Cron-Token` (sent by the pg_cron scheduler and
 *    checked by the service-role-only `verify_cron_hook_token` function), or
 *  - a Bearer access token belonging to a signed-in admin (used by the admin dashboard).
 *
 * The old `X-Cron-Secret` header / CRON_HOOK_SECRET is deliberately NOT accepted: its
 * value was committed to the repository, so it must be treated as public.
 *
 * Returns null when authorized, otherwise a Response to return immediately.
 */
export async function authorizeCronRequest(request: Request): Promise<Response | null> {
  const unauthorized = () =>
    new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });

  const cronToken = request.headers.get("x-cron-token")?.trim();
  if (cronToken) {
    const { data: ok, error } = await supabaseAdmin.rpc("verify_cron_hook_token", {
      p_token: cronToken,
    });
    if (error) console.error("cron token check failed:", error.message);
    if (ok === true) return null;
    return unauthorized();
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return unauthorized();
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return unauthorized();

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return unauthorized();

  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleRow) {
    return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}
