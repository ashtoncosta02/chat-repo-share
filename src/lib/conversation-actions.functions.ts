import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { placeOutboundCall } from "@/server/elevenlabs-agent.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const PROJECT_ID = "d1e796ad-671c-47e1-843b-cdecc02fe11f";

const CallInput = z.object({
  accessToken: z.string().min(1),
  conversationId: z.string().uuid(),
  instructions: z.string().trim().max(1000).optional().default(""),
});

const SmsInput = z.object({
  accessToken: z.string().min(1),
  conversationId: z.string().uuid(),
  message: z.string().trim().min(1).max(1500),
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

async function loadContext(userId: string, conversationId: string) {
  const { data: convo } = await supabaseAdmin
    .from("conversations")
    .select("id, user_id, agent_id, lead_id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!convo) return { error: "Conversation not found." as const };

  // Try multiple paths: conversations.lead_id -> leads.conversation_id -> any
  // lead sharing the same phone as another conversation linked to this caller.
  let lead: { id: string; name: string | null; phone: string | null; notes: string | null } | null = null;

  if (convo.lead_id) {
    const { data } = await supabaseAdmin
      .from("leads")
      .select("id, name, phone, notes")
      .eq("id", convo.lead_id)
      .eq("user_id", userId)
      .maybeSingle();
    lead = data ?? null;
  }
  if (!lead) {
    const { data } = await supabaseAdmin
      .from("leads")
      .select("id, name, phone, notes")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    lead = data ?? null;
  }
  if (!lead) return { error: "No saved lead is linked to this conversation." as const };
  if (!lead.phone) return { error: "This caller has no phone number on file." as const };

  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("id, elevenlabs_agent_id, assistant_name, business_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!agent?.elevenlabs_agent_id) {
    return { error: "Your receptionist isn't connected yet. Save your settings first." as const };
  }

  const { data: phone } = await supabaseAdmin
    .from("phone_numbers")
    .select("phone_number, elevenlabs_phone_number_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!phone?.phone_number) {
    return { error: "No connected phone number. Connect one in Phone Numbers first." as const };
  }
  if (!phone.elevenlabs_phone_number_id) {
    return {
      error: "Your number isn't linked to the AI yet. Open Phone Numbers and click 'Connect to AI'." as const,
    };
  }

  return {
    lead,
    agent,
    fromNumber: phone.phone_number,
    elPhoneNumberId: phone.elevenlabs_phone_number_id,
  };
}

/** Place an outbound AI call about a specific conversation, with optional custom instructions. */
export const aiCallbackFromConversation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CallInput.parse(input))
  .handler(async ({ data }) => {
    const auth = await authUser(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const ctx = await loadContext(auth.userId, data.conversationId);
    if ("error" in ctx) return { success: false as const, error: ctx.error };
    const { lead, agent, elPhoneNumberId } = ctx;

    const firstName = (lead.name ?? "").trim().split(/\s+/)[0] || "there";
    const instructions = data.instructions?.trim() ?? "";

    try {
      const result = await placeOutboundCall({
        agentId: agent.elevenlabs_agent_id!,
        agentPhoneNumberId: elPhoneNumberId,
        toNumber: lead.phone!,
        dynamicVariables: {
          call_direction: "outbound",
          lead_name: firstName === "there" ? "" : firstName,
          lead_notes: instructions ? `Call goal: ${instructions}` : "",
        },
      });


      await supabaseAdmin
        .from("leads")
        .update({ status: "contacted", last_message_at: new Date().toISOString() })
        .eq("id", lead.id);

      return { success: true as const, callSid: result.call_sid ?? null };
    } catch (e) {
      console.error("aiCallbackFromConversation error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Could not place the call.",
      };
    }
  });

/** Send an SMS from the connected Twilio number to the caller on this conversation. */
export const sendSmsFromConversation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SmsInput.parse(input))
  .handler(async ({ data }) => {
    const auth = await authUser(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const ctx = await loadContext(auth.userId, data.conversationId);
    if ("error" in ctx) return { success: false as const, error: ctx.error };
    const { lead, fromNumber } = ctx;

    try {
      const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: "POST",
        headers: {
          ...gatewayHeaders(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: lead.phone!,
          From: fromNumber,
          Body: data.message,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result?.message || `Twilio SMS failed (${res.status}).`);

      // Persist the outbound text so the full SMS thread is visible in the dashboard.
      await supabaseAdmin.from("messages").insert({
        user_id: auth.userId,
        conversation_id: data.conversationId,
        role: "assistant",
        content: data.message,
      });
      await supabaseAdmin
        .from("conversations")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", data.conversationId);

      await supabaseAdmin
        .from("leads")
        .update({ status: "contacted", last_message_at: new Date().toISOString() })
        .eq("id", lead.id);

      return { success: true as const, sid: result.sid ?? null };
    } catch (e) {
      console.error("sendSmsFromConversation error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Could not send the text.",
      };
    }
  });
