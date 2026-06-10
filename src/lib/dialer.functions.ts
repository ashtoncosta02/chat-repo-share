import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const PROJECT_ID = "d1e796ad-671c-47e1-843b-cdecc02fe11f";

const Input = z.object({
  accessToken: z.string().min(1),
  to: z.string().trim().min(3).max(20),
  myPhone: z.string().trim().min(3).max(20),
});

async function authUser(token: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { error: "Unauthorized." as const };
  return { userId: data.user.id };
}

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

function normalizeE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return null;
    return `+${digits}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`; // default US/CA
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function signDialerToken(to: string, from: string, expiresAt: number): Promise<string> {
  const { createHmac } = await import("crypto");
  const secret = process.env.LOVABLE_API_KEY;
  if (!secret) throw new Error("LOVABLE_API_KEY is not configured");
  const payload = `${to}|${from}|${expiresAt}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Place an outbound call FROM the user's owned Twilio number.
 * Twilio first rings the user's personal phone; when they answer, it bridges to `to`. */
export const startOutboundCall = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const auth = await authUser(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const toE164 = normalizeE164(data.to);
    const myE164 = normalizeE164(data.myPhone);
    if (!toE164) return { success: false as const, error: "Enter a valid number to dial." };
    if (!myE164) return { success: false as const, error: "Enter a valid callback number for yourself." };

    const { data: phone } = await supabaseAdmin
      .from("phone_numbers")
      .select("phone_number")
      .eq("user_id", auth.userId)
      .limit(1)
      .maybeSingle();
    if (!phone?.phone_number) {
      return {
        success: false as const,
        error: "Connect a phone number first in Phone Numbers.",
      };
    }
    const fromNumber = phone.phone_number;

    const expiresAt = Date.now() + 5 * 60 * 1000;
    const sig = await signDialerToken(toE164, fromNumber, expiresAt);
    const bridgeUrl = `https://project--${PROJECT_ID}-dev.lovable.app/api/public/twilio/dialer-bridge?to=${encodeURIComponent(
      toE164,
    )}&from=${encodeURIComponent(fromNumber)}&exp=${expiresAt}&sig=${sig}`;

    try {
      const res = await fetch(`${GATEWAY_URL}/Calls.json`, {
        method: "POST",
        headers: {
          ...gatewayHeaders(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: myE164,
          From: fromNumber,
          Url: bridgeUrl,
          Method: "POST",
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result?.message || `Twilio call failed (${res.status}).`);
      }
      return { success: true as const, callSid: result.sid ?? null, dialed: toE164, callback: myE164 };
    } catch (e) {
      console.error("startOutboundCall error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Could not place the call.",
      };
    }
  });
