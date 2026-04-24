import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildVoiceSystemPrompt,
  gatherTwiml,
  originFromRequest,
  shouldTransfer,
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
          const confidence = Number(form.get("Confidence") || "0");

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

          if (!speech) {
            return endCall("Sorry, I didn't catch that. Please call back any time.");
          }

          const utterance = speech;
          const modelUtterance = normalizeSpeechForContext(
            speech,
            callerNumber,
            confidence,
          );

          // Pull recent message history in parallel with persisting the
          // caller's utterance. We don't await the insert before calling
          // the model — every saved millisecond cuts dead air on the call.
          const historyPromise = supabaseAdmin
            .from("messages")
            .select("role, content")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true })
            .limit(6);

          // Fire-and-forget: persist caller utterance + capture lead.
          // These don't gate the AI response.
          void supabaseAdmin.from("messages").insert({
            user_id: agent.user_id,
            conversation_id: conversationId,
            role: "user",
            content: utterance,
          });
          void (async () => {
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
          })();

          const { data: history } = await historyPromise;
          const priorMessages = (history || []).map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));
          // Append the current utterance manually since the insert above
          // is fire-and-forget and may not have landed yet.
          priorMessages.push({ role: "user", content: modelUtterance });

          const leadInfoComplete = hasLeadInfo(modelUtterance, priorMessages);

          // Call the AI gateway with the fastest model for voice latency.
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
                  model: "google/gemini-2.5-flash-lite",
                  // Cap output → faster generation + forces concise replies,
                  // which is exactly what we want for spoken phone responses.
                  max_tokens: 80,
                  messages: [
                    {
                      role: "system",
                      content:
                        buildVoiceSystemPrompt(agent, callerNumber) +
                        (leadInfoComplete
                          ? "\n\nThe caller has provided their information. Say a brief thank you and goodbye. Do not ask another question."
                          : ""),
                    },
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
              if (text && text.trim()) reply = text.trim().slice(0, 500);
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

          const shouldEnd = leadInfoComplete || shouldCloseCall(reply);
          const finalReply = shouldEnd ? closingReply(reply) : reply;

          // Synthesize speech immediately. Persist the assistant reply &
          // bump the message count in the background — they don't block
          // the TwiML response.
          void supabaseAdmin.from("messages").insert({
            user_id: agent.user_id,
            conversation_id: conversationId,
            role: "assistant",
            content: finalReply,
          });
          void supabaseAdmin
            .from("conversations")
            .update({ message_count: priorMessages.length + 1 })
            .eq("id", conversationId);

          const baseUrl = originFromRequest(request);

          // If the agent indicated a handoff and we have an emergency
          // number, dial it after speaking the reply.
          const transferTo =
            agent.emergency_number && shouldTransfer(finalReply)
              ? agent.emergency_number
              : null;

          if (transferTo || shouldEnd) {
            await markCallEnded(conversationId);
          }

          return gatherTwiml({
            audioUrl: null,
            fallbackText: finalReply,
            conversationId,
            callerNumber,
            destinationNumber,
            baseUrl,
            hangup: shouldEnd,
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

function normalizeSpeechForContext(
  speech: string,
  callerNumber: string,
  confidence: number,
) {
  const callerContext = callerNumber
    ? ` Caller ID phone number: ${callerNumber}.`
    : " Caller ID phone number is already available.";
  const confidenceContext =
    confidence > 0 && confidence < 0.55
      ? " Speech recognition confidence is low, so ask one short clarifying question if the request is unclear."
      : "";
  return `${speech}${callerContext}${confidenceContext}`;
}

function hasLeadInfo(
  utterance: string,
  priorMessages: { role: "user" | "assistant"; content: string }[],
) {
  const recentText = [...priorMessages.slice(-4).map((m) => m.content), utterance]
    .join(" ")
    .toLowerCase();
  const current = utterance.toLowerCase();
  const hasEmail = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(recentText);
  const hasPhone = (recentText.match(/\d/g) || []).length >= 7;
  const hasNameSignal =
    /\b(my name is|this is|i am|i'm|name's|name is)\b/.test(recentText) ||
    /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(utterance);
  const justProvidedInfo =
    /\b(email|phone|number|name|contact|reach me|call me|text me)\b/.test(current) ||
    hasEmail ||
    hasPhone;
  const assistantAskedForInfo = priorMessages
    .slice(-4)
    .some(
      (m) =>
        m.role === "assistant" &&
        /\b(name|phone|number|email|contact|message|details)\b/i.test(m.content),
    );

  return assistantAskedForInfo && justProvidedInfo && (hasNameSignal || hasEmail || hasPhone);
}

function shouldCloseCall(reply: string) {
  return /\b(thank you|thanks).{0,80}\b(goodbye|bye|have a great|we'?ll be in touch|we will be in touch)\b/i.test(
    reply,
  );
}

function closingReply(reply: string) {
  if (shouldCloseCall(reply)) return reply.slice(0, 220);
  return "Thank you, I have your information. We'll be in touch soon. Goodbye.";
}

async function markCallEnded(conversationId: string) {
  await supabaseAdmin
    .from("conversations")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", conversationId);
}
