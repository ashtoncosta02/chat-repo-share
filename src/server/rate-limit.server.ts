// Fixed-window rate limiting backed by the check_rate_limit database function.
// allowRequest fails OPEN on any error so the app keeps working until the
// database function exists; allowRequestStrict fails closed.
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean | null> {
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
      console.warn("[rate-limit] check_rate_limit failed:", error.message);
      return null;
    }
    return data !== false;
  } catch (e) {
    console.warn("[rate-limit] check_rate_limit threw:", e);
    return null;
  }
}

/** Fails OPEN: allows the request when the limiter is unavailable. */
export async function allowRequest(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  return (await checkRateLimit(key, limit, windowSeconds)) ?? true;
}

/** Fails CLOSED: returns false when the limiter is unavailable (use for once-only side effects). */
export async function allowRequestStrict(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  return (await checkRateLimit(key, limit, windowSeconds)) ?? false;
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
