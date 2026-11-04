// Fixed-window rate limiting backed by the check_rate_limit database function.
// Fails OPEN (allows) on any error so the app keeps working until the
// database function exists.
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function allowRequest(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const rpc = supabaseAdmin.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const { data, error } = await rpc.call(supabaseAdmin, "check_rate_limit" as never, {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.warn("[rate-limit] check_rate_limit failed, allowing:", error.message);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.warn("[rate-limit] check_rate_limit threw, allowing:", e);
    return true;
  }
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Hashed client IP — never store the raw address. */
export function clientIpKey(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  const xff = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return sha256Hex(cf || xff || "unknown");
}
