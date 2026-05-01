import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  importTwilioNumber,
  deleteElevenLabsPhoneNumber,
} from "./elevenlabs-agent.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

/**
 * Best-effort: import a Twilio number into ElevenLabs and link it to the
 * agent. Returns the EL phone_number_id on success, or null if the import
 * failed (we log but never block the Twilio purchase on this).
 */
async function tryLinkToElevenLabs(opts: {
  phoneNumber: string;
  label: string;
  agentId: string;
}): Promise<string | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    console.warn("Skipping ElevenLabs import: TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN not set");
    return null;
  }
  try {
    const { phone_number_id } = await importTwilioNumber({
      phoneNumber: opts.phoneNumber,
      label: opts.label,
      twilioAccountSid: sid,
      twilioAuthToken: token,
      agentId: opts.agentId,
    });
    return phone_number_id;
  } catch (e) {
    console.error("ElevenLabs phone import failed:", e);
    return null;
  }
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

async function getAuthenticatedUserId(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) {
    return { error: "Unauthorized. Please sign in again." as const };
  }
  return { userId: data.user.id };
}

const SearchInput = z.object({
  accessToken: z.string().min(1),
  postalCode: z.string().min(3).max(10).regex(/^[A-Za-z0-9 -]+$/),
  country: z.enum(["US", "CA"]).default("US"),
  smsEnabled: z.boolean().optional(),
  voiceEnabled: z.boolean().optional(),
});

export interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string | null;
  region: string | null;
  postalCode: string | null;
  isoCountry: string;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
}

export const searchNumbersByPostalCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data }) => {
    const auth = await getAuthenticatedUserId(data.accessToken);
    if ("error" in auth) {
      return {
        success: false as const,
        error: auth.error,
        numbers: [] as AvailableNumber[],
      };
    }

    try {
      let postal = data.postalCode.trim().toUpperCase().replace(/\s+/g, "");
      if (data.country === "US") {
        if (!/^\d{5}$/.test(postal)) {
          return {
            success: false as const,
            error: "US ZIP codes must be 5 digits (e.g. 90210).",
            numbers: [] as AvailableNumber[],
          };
        }
      } else {
        if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(postal)) {
          return {
            success: false as const,
            error: "Canadian postal codes look like L7B 1A2.",
            numbers: [] as AvailableNumber[],
          };
        }
        postal = postal.slice(0, 3);
      }

      const params = new URLSearchParams({
        InPostalCode: postal,
        PageSize: "20",
      });
      if (data.smsEnabled) params.set("SmsEnabled", "true");
      if (data.voiceEnabled !== false) params.set("VoiceEnabled", "true");

      const url = `${GATEWAY_URL}/AvailablePhoneNumbers/${data.country}/Local.json?${params.toString()}`;
      const res = await fetch(url, { method: "GET", headers: gatewayHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Twilio search error:", res.status, json, "url:", url);
        const msg =
          res.status === 404
            ? `No numbers available near ${postal}. Try a nearby ${data.country === "US" ? "ZIP" : "postal"} code.`
            : json?.message || `Twilio error (${res.status}). Try a different code.`;
        return {
          success: false as const,
          error: msg,
          numbers: [] as AvailableNumber[],
        };
      }

      const numbers: AvailableNumber[] = (json.available_phone_numbers || []).map(
        (n: Record<string, unknown>) => ({
          phoneNumber: String(n.phone_number || ""),
          friendlyName: String(n.friendly_name || n.phone_number || ""),
          locality: (n.locality as string) || null,
          region: (n.region as string) || null,
          postalCode: (n.postal_code as string) || null,
          isoCountry: (n.iso_country as string) || data.country,
          capabilities: {
            voice: Boolean((n.capabilities as Record<string, unknown>)?.voice),
            sms: Boolean((n.capabilities as Record<string, unknown>)?.SMS),
            mms: Boolean((n.capabilities as Record<string, unknown>)?.MMS),
          },
        }),
      );
      return { success: true as const, numbers };
    } catch (e) {
      console.error("searchNumbersByPostalCode error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Unexpected error searching numbers.",
        numbers: [] as AvailableNumber[],
      };
    }
  });

const PurchaseInput = z.object({
  accessToken: z.string().min(1),
  phoneNumber: z.string().min(8).max(20).regex(/^\+[0-9]+$/),
  agentId: z.string().uuid(),
  postalCode: z.string().min(3).max(10).optional(),
});

export const purchasePhoneNumber = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PurchaseInput.parse(input))
  .handler(async ({ data }) => {
    const auth = await getAuthenticatedUserId(data.accessToken);
    if ("error" in auth) {
      return { success: false as const, error: auth.error };
    }
    const { userId } = auth;

    const { data: agent, error: agentErr } = await supabaseAdmin
      .from("agents")
      .select("id, business_name")
      .eq("id", data.agentId)
      .eq("user_id", userId)
      .maybeSingle();
    if (agentErr || !agent) {
      return { success: false as const, error: "Agent not found." };
    }

    try {
      const PROJECT_ID = "d1e796ad-671c-47e1-843b-cdecc02fe11f";
      // Use the -dev subdomain so webhooks work before the project is published.
      // Once published, you can re-sync to point at the production URL.
      const baseUrl = `https://project--${PROJECT_ID}-dev.lovable.app`;
      const smsWebhook = `${baseUrl}/api/public/twilio/sms`;

      // Voice routing is handled by ElevenLabs after the number is imported
      // into the EL workspace (Twilio → ElevenLabs telephony bridge). We only
      // wire SMS here; EL takes over VoiceUrl on its side.
      const body = new URLSearchParams({
        PhoneNumber: data.phoneNumber,
        FriendlyName: `${agent.business_name} — Agent Factory`,
        SmsUrl: smsWebhook,
        SmsMethod: "POST",
      });
      const res = await fetch(`${GATEWAY_URL}/IncomingPhoneNumbers.json`, {
        method: "POST",
        headers: {
          ...gatewayHeaders(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      const json = await res.json();
      if (!res.ok) {
        console.error("Twilio purchase error:", res.status, json);
        return {
          success: false as const,
          error:
            json?.message ||
            "Could not purchase that number. It may have just been taken — please pick another.",
        };
      }

      const caps = (json.capabilities || {}) as Record<string, unknown>;
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("phone_numbers")
        .insert({
          user_id: userId,
          agent_id: data.agentId,
          twilio_sid: String(json.sid),
          phone_number: String(json.phone_number),
          friendly_name: String(json.friendly_name || ""),
          country: String(json.iso_country || "US"),
          postal_code: data.postalCode || null,
          capabilities: {
            voice: Boolean(caps.voice),
            sms: Boolean(caps.sms),
            mms: Boolean(caps.mms),
          },
          status: "active",
        })
        .select()
        .single();

      if (insertErr) {
        console.error("phone_numbers insert error:", insertErr);
        return {
          success: false as const,
          error: "Number was purchased but could not be saved. Contact support.",
        };
      }

      return { success: true as const, phoneNumber: inserted };
    } catch (e) {
      console.error("purchasePhoneNumber error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Unexpected error purchasing number.",
      };
    }
  });

const ReleaseInput = z.object({
  accessToken: z.string().min(1),
  phoneNumberId: z.string().uuid(),
});

export const releasePhoneNumber = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ReleaseInput.parse(input))
  .handler(async ({ data }) => {
    const auth = await getAuthenticatedUserId(data.accessToken);
    if ("error" in auth) {
      return { success: false as const, error: auth.error };
    }

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("phone_numbers")
      .select("id, twilio_sid")
      .eq("id", data.phoneNumberId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (fetchErr || !row) return { success: false as const, error: "Number not found." };

    try {
      const res = await fetch(`${GATEWAY_URL}/IncomingPhoneNumbers/${row.twilio_sid}.json`, {
        method: "DELETE",
        headers: gatewayHeaders(),
      });
      if (!res.ok && res.status !== 404) {
        const t = await res.text();
        console.error("Twilio release error:", res.status, t);
        return { success: false as const, error: `Could not release number (${res.status}).` };
      }
      await supabaseAdmin.from("phone_numbers").delete().eq("id", row.id);
      return { success: true as const };
    } catch (e) {
      console.error("releasePhoneNumber error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Unexpected error releasing number.",
      };
    }
  });

const SyncWebhooksInput = z.object({
  accessToken: z.string().min(1),
  phoneNumberId: z.string().uuid(),
});

/**
 * Re-points a previously-purchased Twilio number's SMS and Voice
 * webhooks at this app. Useful for numbers bought before the voice
 * webhook existed.
 */
export const syncTwilioWebhooks = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SyncWebhooksInput.parse(input))
  .handler(async ({ data }) => {
    const auth = await getAuthenticatedUserId(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("phone_numbers")
      .select("id, twilio_sid")
      .eq("id", data.phoneNumberId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (fetchErr || !row) return { success: false as const, error: "Number not found." };

    try {
      const PROJECT_ID = "d1e796ad-671c-47e1-843b-cdecc02fe11f";
      // Use the -dev subdomain so webhooks work before the project is published.
      const baseUrl = `https://project--${PROJECT_ID}-dev.lovable.app`;
      // Only re-sync SMS. Voice is owned by ElevenLabs once the number is
      // imported into the EL workspace.
      const body = new URLSearchParams({
        SmsUrl: `${baseUrl}/api/public/twilio/sms`,
        SmsMethod: "POST",
      });
      const res = await fetch(
        `${GATEWAY_URL}/IncomingPhoneNumbers/${row.twilio_sid}.json`,
        {
          method: "POST",
          headers: {
            ...gatewayHeaders(),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        },
      );
      if (!res.ok) {
        const t = await res.text();
        console.error("syncTwilioWebhooks error:", res.status, t);
        return {
          success: false as const,
          error: `Could not update Twilio webhooks (${res.status}).`,
        };
      }
      return { success: true as const };
    } catch (e) {
      console.error("syncTwilioWebhooks exception:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Unexpected error syncing webhooks.",
      };
    }
  });