import { PUBLIC_APP_ORIGIN } from "@/lib/app-origin";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isAllowedNanp, normalize as normalizeE164 } from "@/server/phone-guard.server";
import {
  matchesSavedNumber,
  UNKNOWN_CALLBACK_MESSAGE,
  UNKNOWN_DESTINATION_MESSAGE,
} from "@/lib/dialer-guard";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

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

const DAILY_CALL_CAP = 50;

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

    const { requireEntitlement } = await import("@/server/entitlement.server");
    const gate = await requireEntitlement(auth.userId);
    if (gate) return { success: false as const, error: gate.error };

    const toE164 = normalizeE164(data.to);
    const myE164 = normalizeE164(data.myPhone);
    if (!toE164) return { success: false as const, error: "Enter a valid number to dial." };
    if (!myE164) return { success: false as const, error: "Enter a valid callback number for yourself." };
    if (!isAllowedNanp(toE164) || !isAllowedNanp(myE164)) {
      return { success: false as const, error: "Only US and Canada numbers can be dialed (no premium or international numbers)." };
    }

    // Both legs must come from numbers saved on the server: the first leg rings the
    // owner's own saved phone, the second leg reaches a customer already in Leads.
    const { data: agentRows } = await supabaseAdmin
      .from("agents")
      .select("owner_forward_phone, notify_phone")
      .eq("user_id", auth.userId);
    const ownerPhones = (agentRows ?? []).flatMap((a) => [a.owner_forward_phone, a.notify_phone]);
    if (!matchesSavedNumber(myE164, ownerPhones, normalizeE164)) {
      return { success: false as const, error: UNKNOWN_CALLBACK_MESSAGE };
    }

    const { data: leadRows, error: leadErr } = await supabaseAdmin
      .from("leads")
      .select("phone")
      .eq("user_id", auth.userId)
      .not("phone", "is", null)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (leadErr) {
      console.error("startOutboundCall lead lookup failed:", leadErr.message);
      return { success: false as const, error: "Could not place the call. Please try again." };
    }
    if (!matchesSavedNumber(toE164, (leadRows ?? []).map((l) => l.phone), normalizeE164)) {
      return { success: false as const, error: UNKNOWN_DESTINATION_MESSAGE };
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("dialer_calls")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.userId)
      .gte("created_at", since);
    if ((count ?? 0) >= DAILY_CALL_CAP) {
      return { success: false as const, error: `Daily limit of ${DAILY_CALL_CAP} outbound calls reached. Try again tomorrow.` };
    }

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

    await supabaseAdmin.from("dialer_calls").insert({ user_id: auth.userId, to_number: toE164 });

    const expiresAt = Date.now() + 5 * 60 * 1000;
    const sig = await signDialerToken(toE164, fromNumber, expiresAt);
    const bridgeUrl = `${PUBLIC_APP_ORIGIN}/api/public/twilio/dialer-bridge?to=${encodeURIComponent(
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
