// Server-only: confirm with Twilio that a phone number really phoned or texted
// one of the account's own business numbers before we place an outbound call to it.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decideContactProof, type ContactCheck, type ContactProof } from "@/lib/contact-proof";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const MAX_BUSINESS_NUMBERS = 10;

function gatewayHeaders() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
  if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": TWILIO_API_KEY,
  };
}

async function providerHasRecord(
  resource: "Calls" | "Messages",
  from: string,
  to: string,
): Promise<ContactCheck> {
  try {
    const qs = new URLSearchParams({ From: from, To: to, PageSize: "1" });
    const res = await fetch(`${GATEWAY_URL}/${resource}.json?${qs.toString()}`, {
      method: "GET",
      headers: gatewayHeaders(),
    });
    if (!res.ok) {
      console.error(`contact-proof ${resource} lookup failed (${res.status})`);
      return "error";
    }
    const body = (await res.json().catch(() => null)) as
      | { calls?: unknown[]; messages?: unknown[] }
      | null;
    if (!body) return "error";
    const list = resource === "Calls" ? body.calls : body.messages;
    if (!Array.isArray(list)) return "error";
    return list.length > 0 ? "yes" : "no";
  } catch (e) {
    console.error(`contact-proof ${resource} lookup error:`, e instanceof Error ? e.message : e);
    return "error";
  }
}

/**
 * "verified" only when Twilio's own records show `callerE164` calling or texting
 * one of this user's business numbers. The destination therefore comes from the
 * provider, never from a lead row the account owner can edit.
 */
export async function callerHasContactedBusiness(
  userId: string,
  callerE164: string,
): Promise<ContactProof> {
  const { data: rows, error } = await supabaseAdmin
    .from("phone_numbers")
    .select("phone_number")
    .eq("user_id", userId)
    .limit(MAX_BUSINESS_NUMBERS);
  if (error) {
    console.error("contact-proof phone_numbers lookup failed:", error.message);
    return "error";
  }
  const businessNumbers = [...new Set((rows ?? []).map((r) => r.phone_number).filter(Boolean))];
  if (businessNumbers.length === 0) return "unverified";

  const checks: ContactCheck[] = [];
  for (const to of businessNumbers) {
    const [call, text] = await Promise.all([
      providerHasRecord("Calls", callerE164, to),
      providerHasRecord("Messages", callerE164, to),
    ]);
    checks.push(call, text);
    if (call === "yes" || text === "yes") break;
  }
  return decideContactProof(checks);
}
