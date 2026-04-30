import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createElevenLabsAgent,
  updateElevenLabsAgent,
  deleteElevenLabsAgent,
  getConversationToken,
  importTwilioNumber,
  type AgentBusinessProfile,
} from "./elevenlabs-agent.server";

const SyncInput = z.object({
  accessToken: z.string().min(1),
  agentId: z.string().uuid(),
});

async function authUser(token: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { error: "Unauthorized." as const };
  return { userId: data.user.id };
}

interface AgentRow {
  id: string;
  user_id: string;
  business_name: string;
  assistant_name: string | null;
  industry: string | null;
  tone: string | null;
  primary_goal: string | null;
  services: string | null;
  booking_link: string | null;
  emergency_number: string | null;
  pricing_notes: string | null;
  escalation_triggers: string | null;
  voice_id: string | null;
  faqs_structured: unknown;
  elevenlabs_agent_id: string | null;
}

function rowToProfile(row: AgentRow): AgentBusinessProfile {
  let faqs: AgentBusinessProfile["faqs_structured"] = null;
  if (Array.isArray(row.faqs_structured)) {
    faqs = (row.faqs_structured as unknown[])
      .map((x) => {
        const f = x as { question?: unknown; answer?: unknown };
        return {
          question: typeof f.question === "string" ? f.question : "",
          answer: typeof f.answer === "string" ? f.answer : "",
        };
      })
      .filter((f) => f.question || f.answer);
  }
  return {
    business_name: row.business_name,
    assistant_name: row.assistant_name,
    industry: row.industry,
    tone: row.tone,
    primary_goal: row.primary_goal,
    services: row.services,
    booking_link: row.booking_link,
    emergency_number: row.emergency_number,
    pricing_notes: row.pricing_notes,
    escalation_triggers: row.escalation_triggers,
    voice_id: row.voice_id,
    faqs_structured: faqs,
  };
}

/**
 * Create the EL agent if missing, otherwise update it in place so prompt
 * + voice + FAQs always match what's in our DB.
 */
export const syncReceptionistAgent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SyncInput.parse(input))
  .handler(async ({ data }) => {
    const auth = await authUser(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const { data: row, error: rowErr } = await supabaseAdmin
      .from("agents")
      .select(
        "id, user_id, business_name, assistant_name, industry, tone, primary_goal, services, booking_link, emergency_number, pricing_notes, escalation_triggers, voice_id, faqs_structured, elevenlabs_agent_id",
      )
      .eq("id", data.agentId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (rowErr || !row) return { success: false as const, error: "Receptionist not found." };

    const profile = rowToProfile(row as AgentRow);

    try {
      let elAgentId = row.elevenlabs_agent_id;
      if (elAgentId) {
        await updateElevenLabsAgent(elAgentId, profile);
      } else {
        const created = await createElevenLabsAgent(profile);
        elAgentId = created.agent_id;
        const { error: updErr } = await supabaseAdmin
          .from("agents")
          .update({ elevenlabs_agent_id: elAgentId })
          .eq("id", row.id);
        if (updErr) {
          console.error("Failed to save elevenlabs_agent_id:", updErr);
          // Try to roll the EL agent back to avoid orphans.
          await deleteElevenLabsAgent(elAgentId).catch(() => {});
          return { success: false as const, error: "Could not save voice agent ID." };
        }
      }
      return { success: true as const, elevenlabs_agent_id: elAgentId };
    } catch (e) {
      console.error("syncReceptionistAgent error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Unexpected error syncing receptionist.",
      };
    }
  });

const TokenInput = z.object({
  accessToken: z.string().min(1),
  agentId: z.string().uuid(),
});

/** Returns a short-lived WebRTC conversation token for the browser preview. */
export const getReceptionistPreviewToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    const auth = await authUser(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const { data: row } = await supabaseAdmin
      .from("agents")
      .select("id, elevenlabs_agent_id")
      .eq("id", data.agentId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (!row?.elevenlabs_agent_id) {
      return {
        success: false as const,
        error: "Voice agent not provisioned yet. Save your settings first.",
      };
    }
    try {
      const token = await getConversationToken(row.elevenlabs_agent_id);
      return { success: true as const, token, agentId: row.elevenlabs_agent_id };
    } catch (e) {
      console.error("getReceptionistPreviewToken error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Could not get preview token.",
      };
    }
  });

const LinkPhoneInput = z.object({
  accessToken: z.string().min(1),
  phoneNumberId: z.string().uuid(),
});

/**
 * Imports the Twilio number into ElevenLabs and links it to the user's
 * receptionist. After this, calls to the number ring straight to the EL agent.
 */
export const linkPhoneToReceptionist = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => LinkPhoneInput.parse(input))
  .handler(async ({ data }) => {
    const auth = await authUser(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      return {
        success: false as const,
        error:
          "Twilio account credentials are not configured. The platform owner needs to add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
      };
    }

    const { data: phone } = await supabaseAdmin
      .from("phone_numbers")
      .select("id, phone_number, friendly_name, agent_id")
      .eq("id", data.phoneNumberId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (!phone) return { success: false as const, error: "Phone number not found." };
    if (!phone.agent_id) return { success: false as const, error: "Phone is not linked to a receptionist." };

    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("id, business_name, elevenlabs_agent_id")
      .eq("id", phone.agent_id)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (!agent?.elevenlabs_agent_id) {
      return {
        success: false as const,
        error: "Save your receptionist settings first so we can provision the voice agent.",
      };
    }

    try {
      const result = await importTwilioNumber({
        phoneNumber: phone.phone_number,
        label: phone.friendly_name || agent.business_name,
        twilioAccountSid: accountSid,
        twilioAuthToken: authToken,
        agentId: agent.elevenlabs_agent_id,
      });
      return { success: true as const, phone_number_id: result.phone_number_id };
    } catch (e) {
      console.error("linkPhoneToReceptionist error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Could not link phone to receptionist.",
      };
    }
  });
