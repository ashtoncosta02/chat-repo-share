import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Guard for the /api/public/hooks/* maintenance endpoints.
 *
 * Accepts either:
 *  - the shared cron secret in `X-Cron-Secret` (used by the pg_cron scheduler), or
 *  - a Bearer access token belonging to a signed-in admin (used by the admin dashboard).
 *
 * Returns null when authorized, otherwise a Response to return immediately.
 */
export async function authorizeCronRequest(request: Request): Promise<Response | null> {
  const unauthorized = () =>
    new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });

  const secret = process.env.CRON_HOOK_SECRET;
  const provided = request.headers.get("x-cron-secret");
  if (secret && provided && safeEqual(provided, secret)) return null;

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
