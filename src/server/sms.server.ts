import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

interface SendSmsParams {
  to: string;
  from: string;
  body: string;
}

/** Low-level Twilio SMS send via the connector gateway. */
export async function sendSms({ to, from, body }: SendSmsParams): Promise<string | null> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
  if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
    console.warn("sendSms: Twilio connector not configured");
    return null;
  }
  const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || `Twilio SMS failed (${res.status})`);
  }
  return json.sid ?? null;
}

interface TranscriptSmsParams {
  userId: string;
  to: string;
  businessName: string;
  callerNumber: string | null;
  durationSeconds: number;
  summary: string;
  dashboardUrl: string;
}

/** Pick the owner's connected Twilio number to send notifications from. */
async function getOwnerFromNumber(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("phone_numbers")
    .select("phone_number")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.phone_number ?? null;
}

/** Compose + send a short SMS summary of a finished call. */
export async function sendTranscriptSms(params: TranscriptSmsParams): Promise<string | null> {
  const from = await getOwnerFromNumber(params.userId);
  if (!from) {
    console.warn("sendTranscriptSms: no connected phone number for user", params.userId);
    return null;
  }
  const mins = Math.floor(params.durationSeconds / 60);
  const secs = params.durationSeconds % 60;
  const duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  const caller = params.callerNumber ? ` from ${params.callerNumber}` : "";
  const summary =
    (params.summary || "No summary available.").trim().slice(0, 600);
  const body =
    `${params.businessName}: new call${caller} (${duration}).\n\n` +
    `${summary}\n\n` +
    `Full transcript: ${params.dashboardUrl}`;
  return sendSms({ to: params.to, from, body });
}
