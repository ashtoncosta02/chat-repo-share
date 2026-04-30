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
import { coerceFaqs, faqsToPromptText, faqAllowsSms } from "@/lib/faqs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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
  sms_followup_enabled: boolean | null;
  pricing_notes: string | null;
  booking_link: string | null;
  emergency_number: string | null;
  primary_goal: string | null;
  escalation_triggers: string | null;
}): string {
  const name = agent.assistant_name || "Assistant";
  const tone = agent.tone || "friendly and professional";

  const sections: string[] = [
    `You are ${name}, the AI receptionist for ${agent.business_name}.`,
    `Tone: ${tone}. Be concise — keep responses to 1–3 short sentences unless the user asks for detail. Use plain language. Format with markdown when helpful (lists, bold).`,
    `Your job: answer visitor questions about the business, qualify leads, and capture contact info (name, email) when they show interest in booking, pricing, or follow-up.`,
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

  if (agent.booking_link) sections.push(`Booking link to share when relevant: ${agent.booking_link}`);
  if (agent.emergency_number) sections.push(`For urgent issues, share this emergency number: ${agent.emergency_number}.`);
  if (agent.escalation_triggers) sections.push(`Escalate (suggest contacting a human) when: ${agent.escalation_triggers}.`);

  sections.push(
    `Rules: Never invent services, prices, or hours not listed above. If you don't know, say you'll have someone follow up and ask for the visitor's email. Never claim to be human.`
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
            "id, user_id, business_name, assistant_name, tone, industry, services, faqs, pricing_notes, booking_link, emergency_number, primary_goal, escalation_triggers"
          )
          .eq("id", agentId)
          .maybeSingle();

        if (agentErr || !agent) return jsonResponse({ error: "Agent not found" }, 404);

        // Find or create conversation
        const { data: existingConvo } = await supabaseAdmin
          .from("widget_conversations")
          .select("id")
          .eq("agent_id", agentId)
          .eq("session_token", sessionToken)
          .maybeSingle();

        let conversationId: string;
        if (existingConvo) {
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
        } catch (err) {
          console.error("Failed to persist assistant message:", err);
        }

        // Fire-and-forget lead capture — never block the response.
        // Only run when there's enough context (>=2 user messages) to avoid
        // wasting tokens on a single "hi".
        const userMsgCount = messages.filter((m) => m.role === "user").length;
        if (userMsgCount >= 2) {
          const allMessages = [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "assistant" as const, content: finalText },
          ];
          captureLeadFromWidget({
            agentId,
            userId: agent.user_id,
            conversationId,
            messages: allMessages,
          }).catch((e) => console.error("lead capture bg error:", e));
        }

        return sseFromText(finalText, conversationId);
      },
    },
  },
});
