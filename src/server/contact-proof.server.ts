// Server-only: confirm with Twilio that a phone number really phoned or texted
// one of the account's own business numbers before we place an outbound call to it.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  decideContactProof,
  textMentionsNumber,
  type ContactCheck,
  type ContactProof,
} from "@/lib/contact-proof";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const MAX_BUSINESS_NUMBERS = 10;
const MAX_WIDGET_MESSAGES = 500;

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
 * "yes" when a website visitor typed this number in one of the user's chat
 * conversations. widget_messages is written only by the server's public chat
 * route (owners may read, never insert or edit), so it can't be faked by
 * editing a lead.
 */
async function numberTypedInWidgetChat(userId: string, e164: string): Promise<ContactCheck> {
  const digits = e164.replace(/\D/g, "");
  if (digits.length < 7) return "no";
  const lastFour = digits.slice(-4);
  const { data, error } = await supabaseAdmin
    .from("widget_messages")
    .select("content, widget_conversations!inner(user_id)")
    .eq("widget_conversations.user_id", userId)
    .eq("role", "user")
    .like("content", `%${lastFour}%`)
    .order("created_at", { ascending: false })
    .limit(MAX_WIDGET_MESSAGES);
  if (error) {
    console.error("contact-proof widget lookup failed:", error.message);
    return "error";
  }
  return (data ?? []).some((m) => textMentionsNumber(m.content, e164)) ? "yes" : "no";
}

/**
 * "verified" only when Twilio's own records show `callerE164` calling or texting
 * one of this user's business numbers, or a visitor typed it in this user's
 * website chat. The proof therefore comes from records only our server writes,
 * never from a lead row the account owner can edit.
 */
export async function callerHasContactedBusiness(
  userId: string,
  callerE164: string,
): Promise<ContactProof> {
  const widget = await numberTypedInWidgetChat(userId, callerE164);
  if (widget === "yes") return "verified";

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

  const checks: ContactCheck[] = [widget];
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
