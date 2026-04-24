import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildVoiceSystemPrompt,
  gatherTwiml,
  originFromRequest,
  prepareAudioUrl,
  xmlResponse,
} from "@/server/voice-call-helpers";

/**
 * Twilio inbound VOICE webhook — first hit when one of our numbers rings.
 *
 * Twilio POSTs application/x-www-form-urlencoded with `From`, `To`, `CallSid`.
 * We:
 *   1. Look up which agent owns the destination number.
 *   2. Create (or reuse) a `conversations` row to log this call.
 *   3. Synthesize a greeting in the agent's selected ElevenLabs voice.
 *   4. Return TwiML that <Play>s the greeting and <Gather>s the caller's
 *      first spoken utterance, sending it to /api/public/twilio/voice/turn.
 *
 * Subsequent turns are handled by api.public.twilio.voice.turn.ts.
 *
 * Public route (no JWT) — Twilio can't authenticate. The only side effects
 * are writes scoped to the agent owner's user_id, derived server-side from
 * the destination number. In production, also verify X-Twilio-Signature.
 */
export const Route = createFileRoute("/api/public/twilio/voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const from = String(form.get("From") || "").trim();
          const to = String(form.get("To") || "").trim();
          const callSid = String(form.get("CallSid") || "").trim();

          if (!from || !to) {
            return fallbackHangup("Sorry, we couldn't process this call.");
          }

          // Destination number → agent → owner
          const { data: phoneRow, error: phoneErr } = await supabaseAdmin
            .from("phone_numbers")
            .select("id, user_id, agent_id")
            .eq("phone_number", to)
            .maybeSingle();

          if (phoneErr || !phoneRow || !phoneRow.agent_id) {
            console.error("voice: phone not found or unassigned", { to, phoneErr });
            return fallbackHangup(
              "This number isn't connected to an AI agent yet. Goodbye.",
            );
          }

          const { data: agent, error: agentErr } = await supabaseAdmin
            .from("agents")
            .select(
              "id, user_id, business_name, industry, tone, primary_goal, services, booking_link, emergency_number, faqs, pricing_notes, escalation_triggers, assistant_name, voice_id",
            )
            .eq("id", phoneRow.agent_id)
            .maybeSingle();

          if (agentErr || !agent) {
            console.error("voice: agent not found", phoneRow.agent_id, agentErr);
            return fallbackHangup("Sorry, this AI agent is unavailable right now.");
          }

          // Always start a fresh conversation per call so the transcript
          // and duration are scoped to this single phone call.
          const { data: newConv, error: convErr } = await supabaseAdmin
            .from("conversations")
            .insert({
              user_id: agent.user_id,
              agent_id: agent.id,
            })
            .select("id")
            .single();
          if (convErr || !newConv) {
            console.error("voice: conversation insert failed", convErr);
            return fallbackHangup("Sorry, we hit a technical issue. Please call back.");
          }
          const conversationId = newConv.id;

          // Greeting — same style as the in-app chat
          const assistantName = agent.assistant_name || "Ava";
          const greetingText = `Hi, thanks for calling ${agent.business_name}. This is ${assistantName}. How can I help you today?`;

          // Persist the greeting as the first assistant message in the transcript
          await supabaseAdmin.from("messages").insert({
            user_id: agent.user_id,
            conversation_id: conversationId,
            role: "assistant",
            content: greetingText,
          });

          const audioUrl = prepareAudioUrl(greetingText, agent.voice_id, originFromRequest(request));

          // Start recording the whole call (fire-and-forget). Twilio will
          // POST to /api/public/twilio/recording when the recording is
          // ready (after the call ends).
          if (callSid) {
            void startCallRecording({
              callSid,
              callbackUrl: `${originFromRequest(request)}/api/public/twilio/recording?cid=${conversationId}`,
            });
          }

          return gatherTwiml({
            audioUrl,
            fallbackText: greetingText,
            conversationId,
            callerNumber: from,
            destinationNumber: to,
            baseUrl: originFromRequest(request),
          });
        } catch (e) {
          console.error("voice webhook error:", e);
          return fallbackHangup(
            "Sorry, something went wrong on our end. Please try again later.",
          );
        }
      },
    },
  },
});

function fallbackHangup(text: string) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">${text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</Say><Hangup/></Response>`;
  return xmlResponse(xml);
}

/**
 * Tell Twilio to start recording the in-progress call. Twilio will POST
 * to `callbackUrl` once the recording is processed (after the call ends).
 */
async function startCallRecording(opts: {
  callSid: string;
  callbackUrl: string;
}) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const twilioKey = process.env.TWILIO_API_KEY;
  if (!lovableKey || !twilioKey) {
    console.error("voice: cannot start recording — connector keys missing");
    return;
  }
  try {
    const res = await fetch(
      `https://connector-gateway.lovable.dev/twilio/Calls/${encodeURIComponent(
        opts.callSid,
      )}/Recordings.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": twilioKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          RecordingStatusCallback: opts.callbackUrl,
          RecordingStatusCallbackMethod: "POST",
          RecordingChannels: "dual",
          RecordingTrack: "both",
        }).toString(),
      },
    );
    if (!res.ok) {
      console.error(
        "voice: start recording failed",
        res.status,
        await res.text(),
      );
    }
  } catch (e) {
    console.error("voice: startCallRecording error", e);
  }
}

// Keep buildVoiceSystemPrompt referenced so the import isn't tree-shaken
// when this file is the only consumer at certain build phases.
void buildVoiceSystemPrompt;
