import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  BOOKING_TOOLS,
  bookAppointment,
  buildBookingPromptAddendum,
  findAvailableSlots,
  getCalendarConfig,
  isCalendarConnected,
} from "@/server/widget-booking-tools";
import { captureLeadFromWidget } from "@/server/widget-lead-capture";
import {
  ensureThreadForWidgetConversation,
  maybeNotifyOwnerForWidgetChat,
  mirrorTurnToThread,
} from "@/server/widget-thread-mirror.server";
import { sendScenarioPostCallSms } from "@/server/scenario-sms.server";
import { coerceFaqs, faqsToPromptText, faqAllowsSms } from "@/lib/faqs";
import { coerceScenarios, fieldLabel, type StructuredScenario } from "@/lib/scenarios";

/** Render scenarios for the chat widget (no phone-transfer language). */
function scenariosToChatPromptText(scenarios: StructuredScenario[]): string {
  const usable = scenarios.filter((s) => s.intent.trim());
  if (usable.length === 0) return "";
  const blocks: string[] = [];
  for (const s of usable) {
    const parts: string[] = [`If the visitor wants to ${s.intent.trim()}:`];
    s.steps.forEach((step, i) => {
      if (step.kind === "collect_info" && step.fields.length > 0) {
        parts.push(`  ${i + 1}. Collect: ${step.fields.map(fieldLabel).join(", ")}.`);
      } else if (step.kind === "instruction" && step.text.trim()) {
        parts.push(`  ${i + 1}. ${step.text.trim()}`);
      }
    });
    if (s.action) {
      if (s.action.type === "call_transfer") {
        parts.push(
          `  Then let them know a team member will call them shortly at the number they provided (this is a chat — you cannot transfer calls).`,
        );
      } else if (s.action.type === "post_call_sms") {
        parts.push(`  Then let them know the team will follow up by text shortly.`);
      } else if (s.action.type === "schedule_appointment") {
        parts.push(`  Then help them book an appointment using the booking tool if available, or collect a preferred time and email.`);
      }
    }
    blocks.push(parts.join("\n"));
  }
  return blocks.join("\n\n");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const WIDGET_SESSION_IDLE_MS = 30 * 60 * 1000;

function isStaleWidgetConversation(updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return false;
  const updated = new Date(updatedAt).getTime();
  if (!Number.isFinite(updated)) return false;
  return Date.now() - updated > WIDGET_SESSION_IDLE_MS;
}

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  agentId: string;
  sessionToken: string;
  messages: IncomingMessage[];
  pageUrl?: string;
  visitorName?: string;
  visitorEmail?: string;
}

function buildSystemPrompt(agent: {
  business_name: string;
  assistant_name: string | null;
  tone: string | null;
  industry: string | null;
  services: string | null;
  faqs: string | null;
  faqs_structured: unknown;
  scenarios: unknown;
  sms_followup_enabled: boolean | null;
  pricing_notes: string | null;
  booking_link: string | null;
  emergency_number: string | null;
  primary_goal: string | null;
  escalation_triggers: string | null;
  widget_instructions: string | null;
}): string {
  const name = agent.assistant_name || "Assistant";
  const tone = agent.tone || "friendly and professional";

  const sections: string[] = [
    `You are ${name}, the AI receptionist for ${agent.business_name}. Your name is ${name} — if the visitor asks who you are or what your name is, always say "${name}". Never refer to yourself by any other name (do not call yourself Janice, Assistant, or anything else) even if example text elsewhere in this prompt uses a different name.`,
    `Tone: ${tone}. Be concise — keep responses to 1–3 short sentences unless the user asks for detail. Use plain language. Format with markdown when helpful (lists, bold).`,
    `Your job: answer visitor questions about the business, qualify leads, and capture contact info (name, email, and phone number) when they show interest in booking, pricing, or follow-up. Always ask for a phone number in addition to email so the team can call or text them back — phrase it naturally, e.g. "What's the best phone number to reach you at?"`,
  ];

  if (agent.industry) sections.push(`Industry: ${agent.industry}.`);
  if (agent.primary_goal) sections.push(`Primary goal of this conversation: ${agent.primary_goal}.`);
  if (agent.services) sections.push(`Services offered:\n${agent.services}`);
  if (agent.pricing_notes) sections.push(`Pricing notes:\n${agent.pricing_notes}`);

  // Structured FAQs (preferred) with optional SMS-follow-up offer.
  const structured = coerceFaqs(agent.faqs_structured);
  const smsDefault = agent.sms_followup_enabled ?? false;
  if (structured.length > 0) {
    sections.push(`FAQs:\n${faqsToPromptText(structured)}`);
    const smsTopics = structured
      .filter((f) => faqAllowsSms(f, smsDefault))
      .map((f) => f.question.trim())
      .filter(Boolean);
    if (smsTopics.length > 0) {
      sections.push(
        `SMS follow-up: After answering one of these FAQs, you may offer to text the visitor the answer. Ask "Would you like me to text that to you?" then ask for their phone number.\nSMS-eligible topics:\n${smsTopics.map((q) => `- ${q}`).join("\n")}`
      );
    } else if (smsDefault) {
      sections.push(
        `SMS follow-up: After answering any FAQ, you may offer to text the visitor the answer. Ask "Would you like me to text that to you?" then ask for their phone number.`
      );
    }
  } else if (agent.faqs) {
    sections.push(`FAQs:\n${agent.faqs}`);
  }

  const scenarios = coerceScenarios(agent.scenarios);
  const scenarioText = scenariosToChatPromptText(scenarios);
  if (scenarioText) {
    sections.push(
      `Scenarios (follow these step-by-step flows when the visitor's intent matches):\n${scenarioText}`,
    );
  }

  if (agent.booking_link) {
    sections.push(
      `Booking link: ${agent.booking_link}. Share this link when a visitor wants to book. You do NOT have live calendar access from this chat unless a booking tool is explicitly provided below — do NOT confirm a specific date/time yourself. If they want a specific time, collect their name, email, phone, and preferred time, and say a team member will confirm shortly.`,
    );
  } else {
    sections.push(
      `Bookings: You CANNOT book appointments and have NO calendar access. NEVER agree to a specific date or time proposed by the visitor. If they ask for an appointment, say: "I can't book appointments directly, but I can pass your details to the team and someone will reach out to confirm a time." Then collect name, email, phone number, and preferred day/time as a note.`,
    );
  }
  if (agent.emergency_number) sections.push(`For urgent issues, share this emergency number: ${agent.emergency_number}.`);
  if (agent.escalation_triggers) sections.push(`Escalate (suggest contacting a human) when: ${agent.escalation_triggers}.`);

  if (agent.widget_instructions && agent.widget_instructions.trim()) {
    sections.push(
      `Additional instructions from the business owner (these take priority — follow them carefully):\n${agent.widget_instructions.trim()}`,
    );
  }

  sections.push(
    `Rules: Never invent services, prices, or hours not listed above. If you don't know, say you'll have someone follow up and ask for the visitor's email. Never claim to be human. Do not repeat filler phrases like "yes we can definitely help with that" — get straight to the useful answer.`
  );

  return sections.join("\n\n");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Wrap a final assistant message as a single SSE event so the existing client
// parser (which expects OpenAI-style `data: {choices:[{delta:{content}}]}`) works.
function sseFromText(text: string, conversationId: string): Response {
  const encoder = new TextEncoder();
  const chunks = [
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`,
    `data: [DONE]\n\n`,
  ];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Conversation-Id": conversationId,
    },
  });
}

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface AIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

async function callAI(
  apiKey: string,
  body: {
    messages: AIMessage[];
    tools?: typeof BOOKING_TOOLS;
  },
): Promise<
  | { ok: true; message: AIMessage }
  | { ok: false; status: number; error: string }
> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: body.messages,
      tools: body.tools,
      stream: false,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, error: text };
  }
  const json = await res.json();
  const message = json.choices?.[0]?.message as AIMessage | undefined;
  if (!message) return { ok: false, status: 500, error: "No message in AI response" };
  return { ok: true, message };
}

export const Route = createFileRoute("/api/public/widget/chat")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        let body: ChatRequest;
        try {
          body = (await request.json()) as ChatRequest;
        } catch {
          return jsonResponse({ error: "Invalid JSON" }, 400);
        }

        const { agentId, sessionToken, messages, pageUrl } = body;

        if (
          !agentId ||
          typeof agentId !== "string" ||
          !sessionToken ||
          typeof sessionToken !== "string" ||
          !Array.isArray(messages) ||
          messages.length === 0
        ) {
          return jsonResponse({ error: "Missing fields" }, 400);
        }

        const lastUser = messages[messages.length - 1];
        if (!lastUser || lastUser.role !== "user" || lastUser.content.length > 4000) {
          return jsonResponse({ error: "Invalid message" }, 400);
        }

        const { data: agent, error: agentErr } = await supabaseAdmin
          .from("agents")
          .select(
            "id, user_id, business_name, assistant_name, tone, industry, services, faqs, faqs_structured, scenarios, sms_followup_enabled, pricing_notes, booking_link, emergency_number, primary_goal, escalation_triggers, widget_instructions"
          )
          .eq("id", agentId)
          .maybeSingle();

        if (agentErr || !agent) return jsonResponse({ error: "Agent not found" }, 404);

        // Find or create conversation
        const { data: existingConvo } = await supabaseAdmin
          .from("widget_conversations")
          .select("id, updated_at")
          .eq("agent_id", agentId)
          .eq("session_token", sessionToken)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let conversationId: string;
        if (existingConvo && !isStaleWidgetConversation(existingConvo.updated_at)) {
          conversationId = existingConvo.id;
        } else {
          const userAgent = request.headers.get("user-agent") || null;
          const { data: newConvo, error: newConvoErr } = await supabaseAdmin
            .from("widget_conversations")
            .insert({
              agent_id: agentId,
              user_id: agent.user_id,
              session_token: sessionToken,
              page_url: pageUrl?.slice(0, 2000) || null,
              user_agent: userAgent?.slice(0, 500) || null,
            })
            .select("id")
            .single();
          if (newConvoErr || !newConvo) return jsonResponse({ error: "Failed to create conversation" }, 500);
          conversationId = newConvo.id;
        }

        await supabaseAdmin.from("widget_messages").insert({
          conversation_id: conversationId,
          role: "user",
          content: lastUser.content,
        });

        // Mirror into the main Threads table so website chats appear
        // alongside voice calls in the dashboard.
        const threadId = await ensureThreadForWidgetConversation({
          widgetConversationId: conversationId,
          userId: agent.user_id,
          agentId: agent.id,
        });
        if (threadId) {
          await mirrorTurnToThread({
            threadId,
            userId: agent.user_id,
            role: "user",
            content: lastUser.content,
          });
        }


        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!LOVABLE_API_KEY) return jsonResponse({ error: "AI gateway not configured" }, 500);

        // Build base system prompt
        let systemPrompt = buildSystemPrompt(agent);

        // If calendar is connected, enable booking tools
        const calendarOn = await isCalendarConnected(agentId);
        let tools: typeof BOOKING_TOOLS | undefined;
        if (calendarOn) {
          const cfg = await getCalendarConfig(agentId);
          if (cfg) {
            systemPrompt += "\n\n" + buildBookingPromptAddendum(cfg);
            tools = BOOKING_TOOLS;
          }
        }

        const aiMessages: AIMessage[] = [
          { role: "system", content: systemPrompt },
          ...messages.slice(-20).map((m) => ({
            role: m.role,
            content: m.content.slice(0, 4000),
          })),
        ];

        // Tool-call loop (max 3 rounds to avoid runaway)
        let finalText = "";
        for (let round = 0; round < 3; round++) {
          const result = await callAI(LOVABLE_API_KEY, { messages: aiMessages, tools });
          if (!result.ok) {
            if (result.status === 429)
              return jsonResponse({ error: "Rate limit reached. Please try again in a moment." }, 429);
            if (result.status === 402)
              return jsonResponse({ error: "AI credits exhausted. Please contact support." }, 402);
            console.error("AI gateway error:", result.status, result.error);
            return jsonResponse({ error: "AI gateway error" }, 500);
          }

          const msg = result.message;
          const toolCalls = msg.tool_calls || [];

          if (toolCalls.length === 0) {
            finalText = (msg.content || "").trim();
            break;
          }

          // Push assistant tool-call message and execute tools
          aiMessages.push({
            role: "assistant",
            content: msg.content || "",
            tool_calls: toolCalls,
          });

          for (const call of toolCalls) {
            let parsedArgs: Record<string, unknown> = {};
            try {
              parsedArgs = JSON.parse(call.function.arguments || "{}");
            } catch {
              /* ignore */
            }

            let toolResult: unknown;
            try {
              if (call.function.name === "find_available_slots") {
                toolResult = await findAvailableSlots(agentId, parsedArgs as { date: string });
              } else if (call.function.name === "book_appointment") {
                toolResult = await bookAppointment({
                  agentId,
                  userId: agent.user_id,
                  conversationId,
                  args: parsedArgs as unknown as Parameters<typeof bookAppointment>[0]["args"],
                });
              } else {
                toolResult = { error: `Unknown tool: ${call.function.name}` };
              }
            } catch (err) {
              console.error("Tool execution error:", call.function.name, err);
              toolResult = { error: "Tool execution failed" };
            }

            aiMessages.push({
              role: "tool",
              tool_call_id: call.id,
              name: call.function.name,
              content: JSON.stringify(toolResult),
            });
          }
          // continue loop for follow-up completion
        }

        if (!finalText) {
          finalText = "Sorry, I had trouble completing that. Could you try again?";
        }

        // Persist assistant reply
        try {
          await supabaseAdmin.from("widget_messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: finalText,
          });
          await supabaseAdmin
            .from("widget_conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", conversationId);
          if (threadId) {
            await mirrorTurnToThread({
              threadId,
              userId: agent.user_id,
              role: "assistant",
              content: finalText,
            });
          }
        } catch (err) {
          console.error("Failed to persist assistant message:", err);
        }

        // Lead capture + owner notification. We MUST await these — this runs
        // on Cloudflare Workers, where any un-awaited promise is cancelled the
        // moment the Response is returned. Previously these were fire-and-
        // forget, which is why notified_at stayed null and no email/SMS ever
        // went out for widget chats.
        const userMsgCount = messages.filter((m) => m.role === "user").length;
        if (userMsgCount >= 2 && threadId) {
          const allMessages = [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "assistant" as const, content: finalText },
          ];
          try {
            // Pass the mirrored thread id (not the widget conversation id)
            // so leads.conversation_id links to the row the Threads UI reads,
            // and the visitor's name shows up instead of "Unknown Caller".
            await captureLeadFromWidget({
              agentId,
              userId: agent.user_id,
              conversationId: threadId,
              messages: allMessages,
            });
          } catch (e) {
            console.error("lead capture error:", e);
          }

          // Post-call (post-turn) SMS for triggered scenarios. Runs on the
          // widget too: we look up the captured lead's phone and reuse the
          // same scenario matcher used by voice calls. Deduped per-thread so
          // an ongoing chat doesn't re-send the same message every turn.
          try {
            const { data: leadRow } = await supabaseAdmin
              .from("leads")
              .select("phone")
              .eq("conversation_id", threadId)
              .eq("user_id", agent.user_id)
              .maybeSingle();
            if (leadRow?.phone) {
              await sendScenarioPostCallSms({
                agentId,
                userId: agent.user_id,
                callerNumber: leadRow.phone,
                turns: allMessages,
                dedupeThreadId: threadId,
              });
            }
          } catch (e) {
            console.error("widget scenario sms error:", e);
          }
        }

        if (threadId) {
          try {
            await maybeNotifyOwnerForWidgetChat({
              widgetConversationId: conversationId,
              threadId,
              agentId,
              userId: agent.user_id,
              pageUrl: pageUrl ?? null,
              visitorName: body.visitorName ?? null,
              visitorEmail: body.visitorEmail ?? null,
              userTurnCount: userMsgCount,
            });
          } catch (e) {
            console.error("widget notify error:", e);
          }
        }

        return sseFromText(finalText, conversationId);
      },
    },
  },
});


