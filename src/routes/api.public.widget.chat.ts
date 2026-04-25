import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  pricing_notes: string | null;
  booking_link: string | null;
  emergency_number: string | null;
  primary_goal: string | null;
  escalation_triggers: string | null;
}): string {
  const name = agent.assistant_name || "Assistant";
  const tone = agent.tone || "friendly and professional";

  const sections: string[] = [
    `You are ${name}, the AI chat assistant for ${agent.business_name}.`,
    `Tone: ${tone}. Be concise — keep responses to 1–3 short sentences unless the user asks for detail. Use plain language. Format with markdown when helpful (lists, bold).`,
    `Your job: answer visitor questions about the business, qualify leads, and capture contact info (name, email) when they show interest in booking, pricing, or follow-up.`,
  ];

  if (agent.industry) sections.push(`Industry: ${agent.industry}.`);
  if (agent.primary_goal) sections.push(`Primary goal of this conversation: ${agent.primary_goal}.`);
  if (agent.services) sections.push(`Services offered:\n${agent.services}`);
  if (agent.pricing_notes) sections.push(`Pricing notes:\n${agent.pricing_notes}`);
  if (agent.faqs) sections.push(`FAQs:\n${agent.faqs}`);
  if (agent.booking_link) sections.push(`Booking link to share when relevant: ${agent.booking_link}`);
  if (agent.emergency_number) sections.push(`For urgent issues, share this emergency number: ${agent.emergency_number}.`);
  if (agent.escalation_triggers) sections.push(`Escalate (suggest contacting a human) when: ${agent.escalation_triggers}.`);

  sections.push(
    `Rules: Never invent services, prices, or hours not listed above. If you don't know, say you'll have someone follow up and ask for the visitor's email. Never claim to be human.`
  );

  return sections.join("\n\n");
}

export const Route = createFileRoute("/api/public/widget/chat")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        let body: ChatRequest;
        try {
          body = (await request.json()) as ChatRequest;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
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
          return new Response(JSON.stringify({ error: "Missing fields" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Lightweight per-message cap to prevent abuse
        const lastUser = messages[messages.length - 1];
        if (!lastUser || lastUser.role !== "user" || lastUser.content.length > 4000) {
          return new Response(JSON.stringify({ error: "Invalid message" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Load agent config
        const { data: agent, error: agentErr } = await supabaseAdmin
          .from("agents")
          .select(
            "id, user_id, business_name, assistant_name, tone, industry, services, faqs, pricing_notes, booking_link, emergency_number, primary_goal, escalation_triggers"
          )
          .eq("id", agentId)
          .maybeSingle();

        if (agentErr || !agent) {
          return new Response(JSON.stringify({ error: "Agent not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Find or create the conversation for this session
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

          if (newConvoErr || !newConvo) {
            return new Response(
              JSON.stringify({ error: "Failed to create conversation" }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
          conversationId = newConvo.id;
        }

        // Persist the user's incoming message
        await supabaseAdmin.from("widget_messages").insert({
          conversation_id: conversationId,
          role: "user",
          content: lastUser.content,
        });

        // Build prompt and call Lovable AI Gateway (streaming)
        const systemPrompt = buildSystemPrompt(agent);
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!LOVABLE_API_KEY) {
          return new Response(
            JSON.stringify({ error: "AI gateway not configured" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const upstream = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: systemPrompt },
                ...messages.slice(-20).map((m) => ({
                  role: m.role,
                  content: m.content.slice(0, 4000),
                })),
              ],
              stream: true,
            }),
          }
        );

        if (!upstream.ok) {
          if (upstream.status === 429) {
            return new Response(
              JSON.stringify({
                error: "Rate limit reached. Please try again in a moment.",
              }),
              {
                status: 429,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
          if (upstream.status === 402) {
            return new Response(
              JSON.stringify({
                error: "AI credits exhausted. Please contact support.",
              }),
              {
                status: 402,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
          const detail = await upstream.text();
          console.error("AI gateway error:", upstream.status, detail);
          return new Response(JSON.stringify({ error: "AI gateway error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Tee the stream: forward to client, accumulate to persist on close
        const upstreamBody = upstream.body;
        if (!upstreamBody) {
          return new Response(JSON.stringify({ error: "No stream body" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const decoder = new TextDecoder();
        let assistantContent = "";
        let textBuffer = "";

        const transform = new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            controller.enqueue(chunk);
            // Parse SSE lines for accumulation
            textBuffer += decoder.decode(chunk, { stream: true });
            let nl: number;
            while ((nl = textBuffer.indexOf("\n")) !== -1) {
              let line = textBuffer.slice(0, nl);
              textBuffer = textBuffer.slice(nl + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6).trim();
              if (json === "[DONE]") continue;
              try {
                const parsed = JSON.parse(json);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (typeof delta === "string") assistantContent += delta;
              } catch {
                // partial JSON — wait for more
                textBuffer = line + "\n" + textBuffer;
                break;
              }
            }
          },
          async flush() {
            if (assistantContent.trim()) {
              try {
                await supabaseAdmin.from("widget_messages").insert({
                  conversation_id: conversationId,
                  role: "assistant",
                  content: assistantContent,
                });
                await supabaseAdmin
                  .from("widget_conversations")
                  .update({ updated_at: new Date().toISOString() })
                  .eq("id", conversationId);
              } catch (err) {
                console.error("Failed to persist assistant message:", err);
              }
            }
          },
        });

        return new Response(upstreamBody.pipeThrough(transform), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "X-Conversation-Id": conversationId,
          },
        });
      },
    },
  },
});
