import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
      .select("phone_number")
      .eq("user_id", auth.userId)
      .limit(1)
      .maybeSingle();
    if (!phone?.phone_number) {
      return {
        success: false as const,
        error: "No connected phone number. Connect one in Phone Numbers first.",
      };
    }

    const firstName = (lead.name ?? "").trim().split(/\s+/)[0] ?? "";
    const receptionistName = (agent.assistant_name || "the receptionist").trim();
    const businessName = (agent.business_name || "your business").trim();
    const callbackBase = `https://project--${PROJECT_ID}-dev.lovable.app/api/public/twilio/callback`;
    const callUrl = `${callbackBase}?lead=${encodeURIComponent(lead.id)}&agent=${encodeURIComponent(agent.elevenlabs_agent_id)}`;

    try {
      const res = await fetch(`${GATEWAY_URL}/Calls.json`, {
        method: "POST",
        headers: {
          ...gatewayHeaders(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: lead.phone,
          From: phone.phone_number,
          Url: callUrl,
          Method: "POST",
          MachineDetection: "DetectMessageEnd",
          MachineDetectionTimeout: "30",
          MachineDetectionSpeechThreshold: "2400",
          MachineDetectionSpeechEndThreshold: "1200",
          AsyncAmd: "false",
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result?.message || `Twilio callback failed (${res.status}).`);
      }
      // Mark lead as contacted so it shows progress.
      await supabaseAdmin
        .from("leads")
        .update({ status: "contacted", last_message_at: new Date().toISOString() })
        .eq("id", lead.id);
      return { success: true as const, callSid: result.sid ?? null };
    } catch (e) {
      console.error("aiCallbackLead error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Could not place the call.",
      };
    }
  });
