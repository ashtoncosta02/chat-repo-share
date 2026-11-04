import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyTwilioSignature, formDataToRecord } from "@/server/twilio-signature.server";
import { allowRequest, sha256Hex } from "@/server/rate-limit.server";

const CARRIER_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
  "START",
  "HELP",
]);

function emptyTwiml() {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response/>`, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

/**
 * Twilio inbound SMS webhook.
 *
 * Twilio POSTs application/x-www-form-urlencoded to this URL when one of our
 * numbers receives a text. We look up the agent that owns the destination
 * number, run the same chat logic the in-app chat uses, and reply with TwiML.
 *
 * Public route (no auth) — Twilio cannot send a Lovable JWT, so every request
 * is authenticated with the X-Twilio-Signature header before anything else.
 */
export const Route = createFileRoute("/api/public/twilio/sms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const params = formDataToRecord(form);
          if (!(await verifyTwilioSignature(request, params))) {
            return new Response("Invalid signature", { status: 403 });
          }
          const from = String(form.get("From") || "").trim();
          const to = String(form.get("To") || "").trim();
          const body = String(form.get("Body") || "").trim().slice(0, 1500);

          if (!from || !to) {
            return twiml("Sorry, we couldn't read your message. Please try again.");
          }

          // Find the destination number → agent → owner
          const { data: phoneRow, error: phoneErr } = await supabaseAdmin
            .from("phone_numbers")
            .select("id, user_id, agent_id")
            .eq("phone_number", to)
            .maybeSingle();

          if (phoneErr || !phoneRow || !phoneRow.agent_id) {
            console.error("SMS: phone not found or unassigned", { to, phoneErr });
            return twiml(
              "This number isn't connected to an AI agent yet. Please try again later.",
            );
          }

          const { data: agent, error: agentErr } = await supabaseAdmin
            .from("agents")
            .select(
              "id, user_id, business_name, industry, tone, primary_goal, services, booking_link, emergency_number, faqs, pricing_notes, escalation_triggers, assistant_name",
            )
            .eq("id", phoneRow.agent_id)
            .maybeSingle();

          if (agentErr || !agent) {
            console.error("SMS: agent not found", { agentId: phoneRow.agent_id, agentErr });
            return twiml("Sorry, this AI agent is unavailable right now.");
          }

          // Guards that must run before any AI call.
          if (CARRIER_KEYWORDS.has(body.toUpperCase())) return emptyTwiml();

          const { data: blocked } = await supabaseAdmin
            .from("blocked_callers")
            .select("id")
            .eq("user_id", agent.user_id)
            .eq("phone", from)
            .limit(1)
            .maybeSingle();
          if (blocked) return emptyTwiml();

          const { isEntitled } = await import("@/server/entitlement.server");
          if (!(await isEntitled(agent.user_id))) return emptyTwiml();

          if (!(await allowRequest(`sms-inbound:${sha256Hex(from)}`, 30, 3600))) {
            console.warn("SMS: rate limit reached for sender");
            return emptyTwiml();
          }

          // Find or create the lead for this (agent, From) pair, then reuse
          // only that texter's SMS conversation from the last 24h.
          let leadId: string;
          {
            const { data: existingLead } = await supabaseAdmin
              .from("leads")
              .select("id")
              .eq("agent_id", agent.id)
              .eq("phone", from)
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle();
            if (existingLead) {
              leadId = existingLead.id;
            } else {
              const { data: newLead, error: leadErr } = await supabaseAdmin
                .from("leads")
                .insert({
                  user_id: agent.user_id,
                  agent_id: agent.id,
                  phone: from,
                  source: "sms",
                  notes: "Captured from inbound SMS",
                })
                .select("id")
                .single();
              if (leadErr || !newLead) {
                console.error("SMS: lead insert failed", leadErr);
                return twiml("Sorry, something went wrong. Please try again.");
              }
              leadId = newLead.id;
            }
          }

          const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: existingConv } = await supabaseAdmin
            .from("conversations")
            .select("id")
            .eq("agent_id", agent.id)
            .eq("user_id", agent.user_id)
            .eq("lead_id", leadId)
            .eq("source", "sms")
            .gte("started_at", dayAgo)
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          let conversationId = existingConv?.id;
          if (!conversationId) {
            const { data: newConv, error: convErr } = await supabaseAdmin
              .from("conversations")
              .insert({
                user_id: agent.user_id,
                agent_id: agent.id,
                source: "sms",
                lead_id: leadId,
              })
              .select("id")
              .single();
            if (convErr || !newConv) {
              console.error("SMS: conversation insert failed", convErr);
              return twiml("Sorry, something went wrong. Please try again.");
            }
            conversationId = newConv.id;
            await supabaseAdmin
              .from("leads")
              .update({ conversation_id: conversationId })
              .eq("id", leadId)
              .is("conversation_id", null);
          }

          // Most recent 10 messages, in chronological order.
          const { data: history } = await supabaseAdmin
            .from("messages")
            .select("role, content")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: false })
            .limit(10);

          const priorMessages = (history || []).reverse().map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

          // Persist the inbound user message
          await supabaseAdmin.from("messages").insert({
            user_id: agent.user_id,
            conversation_id: conversationId,
            role: "user",
            content: body || "(empty message)",
          });

          // Build the same system prompt used by in-app chat
          const name = agent.assistant_name || "Janice";
          const system = `You are ${name}, a warm and professional AI receptionist for ${agent.business_name}${agent.industry ? ` (${agent.industry})` : ""}.

You are replying over SMS. Keep replies under 320 characters when possible. Use clear, natural sentences — no markdown, no emojis unless the customer uses them first.

Tone: ${agent.tone || "warm, friendly, professional"}.
Primary goal: ${agent.primary_goal || "Help the customer with information and booking."}

Services:
${agent.services || "(none provided)"}

FAQs:
${agent.faqs || "(none provided)"}

Pricing notes:
${agent.pricing_notes || "(none provided)"}

Booking link: ${agent.booking_link || "(none)"}
Emergency / handoff number: ${agent.emergency_number || "(none)"}
Escalate to a human if: ${agent.escalation_triggers || "(use judgment)"}

Rules:
- If this is the first message of the day, greet them by introducing yourself as ${name}.
- Be concise (1–3 short sentences).
- If they ask to book, share the booking link if available.
- If you don't know, offer to take a message or hand off to a human.`;

          // Call the AI gateway
          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            console.error("SMS: LOVABLE_API_KEY missing");
            return twiml("Sorry, our AI is offline right now. Please try again later.");
          }

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
                  { role: "system", content: system },
                  ...priorMessages,
                  { role: "user", content: body || "(empty message)" },
                ],
              }),
            },
          );

          let reply =
            "Thanks for your message! We'll get back to you shortly.";
          if (aiRes.ok) {
            const json = (await aiRes.json()) as {
              choices?: { message?: { content?: string } }[];
            };
            const text = json.choices?.[0]?.message?.content;
            if (text && text.trim()) reply = text.trim().slice(0, 1500);
          } else {
            console.error("SMS: AI gateway error", aiRes.status, await aiRes.text());
          }

          // Persist the assistant reply
          await supabaseAdmin.from("messages").insert({
            user_id: agent.user_id,
            conversation_id: conversationId,
            role: "assistant",
            content: reply,
          });

          // Bump message_count on conversation
          await supabaseAdmin
            .from("conversations")
            .update({
              message_count: (priorMessages.length || 0) + 2,
              ended_at: new Date().toISOString(),
            })
            .eq("id", conversationId);

          return twiml(reply);
        } catch (e) {
          console.error("SMS webhook error:", e);
          return twiml(
            "Sorry, something went wrong on our end. Please try again in a moment.",
          );
        }
      },
    },
  },
});

function twiml(message: string) {
  // Escape XML special chars
  const safe = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`;
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}
