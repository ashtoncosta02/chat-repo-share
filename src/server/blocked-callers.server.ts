import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { digitsOnly, samePhone } from "@/lib/phone-match";

/** True when `phone` matches any blocked_callers entry for the owner (digit comparison). */
export async function isBlockedCaller(userId: string, phone: string | null | undefined): Promise<boolean> {
  const d = digitsOnly(phone ?? "");
  if (!d) return false;
  const { data } = await supabaseAdmin.from("blocked_callers").select("phone").eq("user_id", userId);
  return (data ?? []).some((b) => samePhone(d, String(b.phone || "")));
}
