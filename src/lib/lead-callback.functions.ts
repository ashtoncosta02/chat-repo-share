import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { placeOutboundCall } from "@/server/elevenlabs-agent.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const PROJECT_ID = "d1e796ad-671c-47e1-843b-cdecc02fe11f";

const Input = z.object({
  accessToken: z.string().min(1),
  leadId: z.string().uuid(),
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

/** Trigger an outbound AI callback to a saved lead via ElevenLabs + Twilio. */
export const aiCallbackLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const auth = await authUser(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const { requireEntitlement } = await import("@/server/entitlement.server");
    const gate = await requireEntitlement(auth.userId);
    if (gate) return { success: false as const, error: gate.error };

    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, user_id, agent_id, name, phone, notes")
      .eq("id", data.leadId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (!lead) return { success: false as const, error: "Lead not found." };
    if (!lead.phone) {
      return { success: false as const, error: "This lead has no phone number on file." };
    }

    // Find the user's receptionist (1-per-account) and a connected phone number.
    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("id, elevenlabs_agent_id, assistant_name, business_name")
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (!agent?.elevenlabs_agent_id) {
      return {
        success: false as const,
        error: "Your receptionist isn't connected yet. Save your settings first.",
      };
    }

    const { data: phone } = await supabaseAdmin
      .from("phone_numbers")
      .select("phone_number, elevenlabs_phone_number_id")
      .eq("user_id", auth.userId)
      .limit(1)
      .maybeSingle();
    if (!phone?.phone_number) {
      return {
        success: false as const,
        error: "No connected phone number. Connect one in Phone Numbers first.",
      };
    }
    if (!phone.elevenlabs_phone_number_id) {
      return {
        success: false as const,
        error: "Your number isn't linked to the AI yet. Open Phone Numbers and click 'Connect to AI'.",
      };
    }

    const firstName = (lead.name ?? "").trim().split(/\s+/)[0] || "there";

    try {
      const result = await placeOutboundCall({
        agentId: agent.elevenlabs_agent_id,
        agentPhoneNumberId: phone.elevenlabs_phone_number_id,
        toNumber: lead.phone,
        dynamicVariables: {
          call_direction: "outbound",
          lead_name: firstName === "there" ? "" : firstName,
          lead_notes: (lead.notes ?? "").slice(0, 1000),
        },
      });

      await supabaseAdmin
        .from("leads")
        .update({ status: "contacted", last_message_at: new Date().toISOString() })
        .eq("id", lead.id);
      return { success: true as const, callSid: result.call_sid ?? null };
    } catch (e) {
      console.error("aiCallbackLead error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Could not place the call.",
      };
    }
  });
