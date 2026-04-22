import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildVoiceSystemPrompt,
  gatherTwiml,
  originFromRequest,
  shouldTransfer,
  synthesizeAndUpload,
  xmlResponse,
} from "@/server/voice-call-helpers";

/**
 * Per-turn handler for inbound voice calls.
 *
 * Twilio's <Gather> POSTs here with `SpeechResult` (the caller's
 * transcribed utterance). We:
 *   1. Load the conversation + agent from the cid query param.
 *   2. Append the caller utterance to messages, call the chat AI,
 *      append the assistant reply.
 *   3. Synthesize the reply, return TwiML that plays it and gathers
 *      the next utterance, OR transfers to the emergency number if
 *      the agent decided to hand off.
 *
 * Loops until the caller hangs up or stays silent through one Gather.
 */
export const Route = createFileRoute("/api/public/twilio/voice/turn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const conversationId = url.searchParams.get("cid") || "";
          const callerNumber = url.searchParams.get("from") || "";
          const destinationNumber = url.searchParams.get("to") || "";

          if (!conversationId || !callerNumber || !destinationNumber) {
            return endCall("Sorry, we lost track of the call. Goodbye.");
          }

          const form = await request.formData();
          const speech = String(form.get("SpeechResult") || "").trim().slice(0, 1500);
          const callStatus = String(form.get("CallStatus") || "");

          // If Twilio reports the call ended, just return an empty 200.
          if (callStatus === "completed") {
            await markCallEnded(conversationId);
            return xmlResponse(
              `<?xml version="1.0" encoding="UTF-8"?><Response/>`,
            );
          }

          // Load conversation + agent
          const { data: conv } = await supabaseAdmin
            .from("conversations")
            .select("id, user_id, agent_id")
            .eq("id", conversationId)
            .maybeSingle();

          if (!conv || !conv.agent_id) {
            return endCall("Sorry, this call session expired. Please call back.");
          }

          const { data: agent } = await supabaseAdmin
            .from("agents")
            .select(
              "id, user_id, business_name, industry, tone, primary_goal, services, booking_link, emergency_number, faqs, pricing_notes, escalation_triggers, assistant_name, voice_id",
            )
            .eq("id", conv.agent_id)
            .maybeSingle();

          if (!agent) {
            return endCall("Sorry, this AI agent is unavailable right now.");
          }

          const utterance = speech || "(caller did not say anything)";

          // Persist the caller's utterance
          await supabaseAdmin.from("messages").insert({
            user_id: agent.user_id,
            conversation_id: conversationId,
            role: "user",
            content: utterance,
          });

          // Pull recent message history for context (last 12 incl. greeting)
          const { data: history } = await supabaseAdmin
            .from("messages")
            .select("role, content")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true })
            .limit(12);

          const priorMessages = (history || []).map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

          // Call the AI gateway
          const apiKey = process.env.LOVABLE_API_KEY;
          let reply =
            "I'm sorry, I'm having trouble right now. Could you please try calling back in a moment?";

          if (apiKey) {
            const aiRes = await fetch(
              "https://ai.gateway.lovable.dev/v1/chat/completions",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash",
                  messages: [
                    { role: "system", content: buildVoiceSystemPrompt(agent) },
                    ...priorMessages,
                  ],
                }),
              },
            );
            if (aiRes.ok) {
              const json = (await aiRes.json()) as {
                choices?: { message?: { content?: string } }[];
              };
              const text = json.choices?.[0]?.message?.content;
              if (text && text.trim()) reply = text.trim().slice(0, 1500);
            } else {
              console.error(
                "voice-turn: AI gateway error",
                aiRes.status,
                await aiRes.text(),
              );
            }
          } else {
            console.error("voice-turn: LOVABLE_API_KEY missing");
          }

          // Persist the assistant reply
          await supabaseAdmin.from("messages").insert({
            user_id: agent.user_id,
            conversation_id: conversationId,
            role: "assistant",
            content: reply,
          });

          // Bump message count
          await supabaseAdmin
            .from("conversations")
            .update({
              message_count: priorMessages.length + 1,
            })
            .eq("id", conversationId);

          // Capture caller's number as a lead (idempotent per agent+phone)
          const { data: existingLead } = await supabaseAdmin
            .from("leads")
            .select("id")
            .eq("agent_id", agent.id)
            .eq("phone", callerNumber)
            .maybeSingle();
          if (!existingLead) {
            await supabaseAdmin.from("leads").insert({
              user_id: agent.user_id,
              agent_id: agent.id,
              phone: callerNumber,
              notes: "Captured from inbound phone call",
            });
          }

          // Synthesize speech for the reply
          const audioUrl = await synthesizeAndUpload(reply, agent.voice_id);

          // If the agent indicated a handoff and we have an emergency
          // number, dial it after speaking the reply.
          const transferTo =
            agent.emergency_number && shouldTransfer(reply)
              ? agent.emergency_number
              : null;

          if (transferTo) {
            await markCallEnded(conversationId);
          }

          return gatherTwiml({
            audioUrl,
            fallbackText: reply,
            conversationId,
            callerNumber,
            destinationNumber,
            baseUrl: originFromRequest(request),
            transferTo,
          });
        } catch (e) {
          console.error("voice-turn webhook error:", e);
          return endCall("Sorry, something went wrong. Please call back.");
        }
      },
    },
  },
});

function endCall(text: string) {
  const safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return xmlResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">${safe}</Say><Hangup/></Response>`,
  );
}

async function markCallEnded(conversationId: string) {
  await supabaseAdmin
    .from("conversations")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", conversationId);
}
