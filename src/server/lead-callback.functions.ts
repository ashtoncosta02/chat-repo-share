import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { placeOutboundCall } from "./elevenlabs-agent.server";

const Input = z.object({
  accessToken: z.string().min(1),
  leadId: z.string().uuid(),
});

async function authUser(token: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { error: "Unauthorized." as const };
  return { userId: data.user.id };
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
      .select("id, elevenlabs_agent_id")
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
      .select("elevenlabs_phone_number_id")
      .eq("user_id", auth.userId)
      .not("elevenlabs_phone_number_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (!phone?.elevenlabs_phone_number_id) {
      return {
        success: false as const,
        error: "No connected phone number. Connect one in Phone Numbers first.",
      };
    }

    const firstName = (lead.name ?? "").trim().split(/\s+/)[0] ?? "";

    try {
      const result = await placeOutboundCall({
        agentId: agent.elevenlabs_agent_id,
        agentPhoneNumberId: phone.elevenlabs_phone_number_id,
        toNumber: lead.phone,
        dynamicVariables: {
          lead_name: firstName,
          lead_notes: (lead.notes ?? "").slice(0, 500),
        },
      });
      // Mark lead as contacted so it shows progress.
      await supabaseAdmin
        .from("leads")
        .update({ status: "contacted", last_message_at: new Date().toISOString() })
        .eq("id", lead.id);
      return { success: true as const, callSid: result.call_sid };
    } catch (e) {
      console.error("aiCallbackLead error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Could not place the call.",
      };
    }
  });
