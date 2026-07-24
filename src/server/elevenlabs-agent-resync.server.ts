import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createElevenLabsAgent,
  updateElevenLabsAgent,
  deleteElevenLabsAgent,
  syncBookingToolsForAgent,
  normalizePhoneE164,
  type AgentBusinessProfile,
} from "./elevenlabs-agent.server";
import { coerceScenarios, scenariosToPromptText } from "@/lib/scenarios";

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
  scenarios: unknown;
  greeting_message: string | null;
  farewell_message: string | null;
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
  const scenarios = coerceScenarios(row.scenarios);
  const scenariosPrompt = scenariosToPromptText(scenarios);
  const transferNumbers: Array<{ phone: string; condition: string }> = [];
  const seen = new Set<string>();
  for (const s of scenarios) {
    if (s.action?.type === "call_transfer") {
      const phone = normalizePhoneE164(s.action.phone);
      const intent = s.intent.trim();
      if (phone && intent) {
        const key = `${phone}::${intent.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          transferNumbers.push({
            phone,
            condition: `The caller wants to ${intent}.`,
          });
        }
      }
    }
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
    scenarios_prompt: scenariosPrompt || null,
    greeting_message: row.greeting_message,
    farewell_message: row.farewell_message,
    transfer_numbers: transferNumbers,
  };
}

export async function resyncReceptionistById(
  agentDbId: string,
): Promise<{ success: true; elevenlabs_agent_id: string } | { success: false; error: string }> {
  const { data: row, error: rowErr } = await supabaseAdmin
    .from("agents")
    .select(
      "id, user_id, business_name, assistant_name, industry, tone, primary_goal, services, booking_link, emergency_number, pricing_notes, escalation_triggers, voice_id, faqs_structured, scenarios, greeting_message, farewell_message, elevenlabs_agent_id",
    )
    .eq("id", agentDbId)
    .maybeSingle();
  if (rowErr || !row) return { success: false, error: "Receptionist not found." };


  const profile = rowToProfile(row as AgentRow);

  try {
    const toolSync = await syncBookingToolsForAgent(row.id).catch((e: unknown) => {
      console.error("syncBookingToolsForAgent failed:", e);
      return { toolIds: [], bookingPromptAddendum: null };
    });
    profile.booking_enabled = toolSync.toolIds.length > 0;
    profile.booking_prompt_addendum = toolSync.bookingPromptAddendum;
    profile.tool_ids = toolSync.toolIds;

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
        await deleteElevenLabsAgent(elAgentId).catch(() => {});
        return { success: false, error: "Could not save voice agent ID." };
      }
    }
    return { success: true, elevenlabs_agent_id: elAgentId };
  } catch (e) {
    console.error("resyncReceptionistById error:", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unexpected error syncing receptionist.",
    };
  }
}