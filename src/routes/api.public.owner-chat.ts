import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

interface OwnerChatRequest {
  messages: IncomingMessage[];
}

const SYSTEM_PROMPT = `You are the in-app help assistant for Agent Factory, a SaaS that lets business owners create AI voice agents and embeddable AI chat widgets for their websites.

Your job:
- Answer questions about how Agent Factory works.
- Help users troubleshoot common issues.
- Guide them to the right page in the app when relevant.

Tone: friendly, concise, plain language. Keep replies to 1–4 short sentences unless the user asks for more detail. Use markdown lists when steps are involved.

Key features you can explain:
- Dashboard: overview of all the user's agents.
- New Agent: walks the user through creating a voice agent (business name, services, FAQs, tone, voice).
- Phone Numbers: shows Twilio numbers connected to agents. Buying or assigning numbers lets the agent answer calls.
- Conversations: transcripts of past calls and chat sessions.
- Leads: contact info captured by agents during conversations.
- Analytics: call volume and performance.
- Chat Widget: gives the user a one-line <script> snippet they can paste into their own website to embed an AI chat assistant powered by their agent.

Common troubleshooting:
- "My phone number isn't ringing the AI" → Make sure the number is assigned to an agent on the Phone Numbers page, and the agent is set to Live.
- "Where do I get the embed code?" → Dashboard → Chat Widget → pick an agent → copy the snippet → paste into your site before </body>.
- "How do I edit what the AI says?" → Open the agent from the Dashboard and update business info, services, FAQs, or tone. Changes apply immediately.

Never invent features that don't exist. If you're not sure, say so and suggest contacting support. Never claim to be a human.`;

export const Route = createFileRoute("/api/public/owner-chat")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        let body: OwnerChatRequest;
        try {
          body = (await request.json()) as OwnerChatRequest;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { messages } = body;
        if (!Array.isArray(messages) || messages.length === 0) {
          return new Response(JSON.stringify({ error: "Missing messages" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const last = messages[messages.length - 1];
        if (!last || last.role !== "user" || last.content.length > 4000) {
          return new Response(JSON.stringify({ error: "Invalid message" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

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
                { role: "system", content: SYSTEM_PROMPT },
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
              JSON.stringify({ error: "Rate limit reached. Try again shortly." }),
              {
                status: 429,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
          if (upstream.status === 402) {
            return new Response(
              JSON.stringify({ error: "AI credits exhausted." }),
              {
                status: 402,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
          const detail = await upstream.text();
          console.error("Owner chat AI error:", upstream.status, detail);
          return new Response(JSON.stringify({ error: "AI gateway error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!upstream.body) {
          return new Response(JSON.stringify({ error: "No stream body" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(upstream.body, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
          },
        });
      },
    },
  },
});
