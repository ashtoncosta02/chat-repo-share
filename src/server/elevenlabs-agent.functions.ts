import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createElevenLabsAgent,
  updateElevenLabsAgent,
  deleteElevenLabsAgent,
  getConversationToken,
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

// Phone-to-EL linking happens via the platform owner uploading Twilio
// account creds in the ElevenLabs dashboard. Once imported there, EL handles
// inbound calls automatically.

const DeleteInput = z.object({
  accessToken: z.string().min(1),
  agentId: z.string().uuid(),
});

/** Removes the EL agent for this receptionist (called before DB delete). */
export const deleteReceptionistAgent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DeleteInput.parse(input))
  .handler(async ({ data }) => {
    const auth = await authUser(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const { data: row } = await supabaseAdmin
      .from("agents")
      .select("elevenlabs_agent_id")
      .eq("id", data.agentId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (!row?.elevenlabs_agent_id) return { success: true as const };
    try {
      await deleteElevenLabsAgent(row.elevenlabs_agent_id);
      return { success: true as const };
    } catch (e) {
      console.error("deleteReceptionistAgent error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Could not delete voice agent.",
      };
    }
  });
