import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
    .select("id, user_id, agent_id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!convo) return { error: "Conversation not found." as const };

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, name, phone, notes")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
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
    .select("phone_number")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!phone?.phone_number) {
    return { error: "No connected phone number. Connect one in Phone Numbers first." as const };
  }

  return { lead, agent, fromNumber: phone.phone_number };
}

/** Place an outbound AI call about a specific conversation, with optional custom instructions. */
export const aiCallbackFromConversation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CallInput.parse(input))
  .handler(async ({ data }) => {
    const auth = await authUser(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const ctx = await loadContext(auth.userId, data.conversationId);
    if ("error" in ctx) return { success: false as const, error: ctx.error };
    const { lead, agent, fromNumber } = ctx;

    const callbackBase = `https://project--${PROJECT_ID}-dev.lovable.app/api/public/twilio/callback`;
    const params = new URLSearchParams({
      lead: lead.id,
      agent: agent.elevenlabs_agent_id!,
    });
    if (data.instructions) {
      // base64-encode to safely pass through query string
      params.set("inst", Buffer.from(data.instructions, "utf-8").toString("base64"));
    }
    const callUrl = `${callbackBase}?${params.toString()}`;

    try {
      const res = await fetch(`${GATEWAY_URL}/Calls.json`, {
        method: "POST",
        headers: {
          ...gatewayHeaders(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: lead.phone!,
          From: fromNumber,
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
      if (!res.ok) throw new Error(result?.message || `Twilio call failed (${res.status}).`);

      await supabaseAdmin
        .from("leads")
        .update({ status: "contacted", last_message_at: new Date().toISOString() })
        .eq("id", lead.id);

      return { success: true as const, callSid: result.sid ?? null };
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
