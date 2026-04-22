import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

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

const SearchInput = z.object({
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const params = new URLSearchParams({
        InPostalCode: data.postalCode.trim(),
        PageSize: "20",
      });
      if (data.smsEnabled) params.set("SmsEnabled", "true");
      if (data.voiceEnabled !== false) params.set("VoiceEnabled", "true");

      const res = await fetch(
        `${GATEWAY_URL}/AvailablePhoneNumbers/${data.country}/Local.json?${params.toString()}`,
        {
          method: "GET",
          headers: gatewayHeaders(),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        console.error("Twilio search error:", res.status, json);
        return {
          success: false as const,
          error:
            json?.message ||
            `No numbers found for ${data.postalCode}. Try a nearby postal code.`,
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
  phoneNumber: z.string().min(8).max(20).regex(/^\+[0-9]+$/),
  agentId: z.string().uuid(),
  postalCode: z.string().min(3).max(10).optional(),
});

export const purchasePhoneNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PurchaseInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify the agent belongs to this user
    const { data: agent, error: agentErr } = await supabase
      .from("agents")
      .select("id, business_name")
      .eq("id", data.agentId)
      .maybeSingle();
    if (agentErr || !agent) {
      return { success: false as const, error: "Agent not found." };
    }

    try {
      const body = new URLSearchParams({
        PhoneNumber: data.phoneNumber,
        FriendlyName: `${agent.business_name} — Agent Factory`,
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
      const { data: inserted, error: insertErr } = await supabase
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

const ReleaseInput = z.object({ phoneNumberId: z.string().uuid() });

export const releasePhoneNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReleaseInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error: fetchErr } = await supabase
      .from("phone_numbers")
      .select("id, twilio_sid")
      .eq("id", data.phoneNumberId)
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
      await supabase.from("phone_numbers").delete().eq("id", row.id);
      return { success: true as const };
    } catch (e) {
      console.error("releasePhoneNumber error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Unexpected error releasing number.",
      };
    }
  });
