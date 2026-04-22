import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ChatInput = z.object({
  agent: z.object({
    business_name: z.string(),
    industry: z.string().nullable().optional(),
    tone: z.string().nullable().optional(),
    primary_goal: z.string().nullable().optional(),
    services: z.string().nullable().optional(),
    booking_link: z.string().nullable().optional(),
    emergency_number: z.string().nullable().optional(),
    faqs: z.string().nullable().optional(),
    pricing_notes: z.string().nullable().optional(),
    escalation_triggers: z.string().nullable().optional(),
    assistant_name: z.string().optional(),
  }),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(50),
});

export const chatWithAgent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ChatInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { success: false as const, error: "AI service is not configured." };
    }

    const a = data.agent;
    const name = a.assistant_name || "Ava";
    const system = `You are ${name}, a warm and professional AI receptionist for ${a.business_name}${a.industry ? ` (${a.industry})` : ""}.

Tone: ${a.tone || "warm, friendly, professional"}.
Primary goal: ${a.primary_goal || "Help callers with information and booking."}

Services:
${a.services || "(none provided)"}

FAQs:
${a.faqs || "(none provided)"}

Pricing notes:
${a.pricing_notes || "(none provided)"}

Booking link: ${a.booking_link || "(none)"}
Emergency / handoff number: ${a.emergency_number || "(none)"}
Escalate to a human if: ${a.escalation_triggers || "(use judgment)"}

Rules:
- The opening greeting has already been delivered. Do NOT introduce yourself again, do NOT say your name again, and do NOT say "this is ${name}" or "I'm ${name}" in any follow-up reply. Just answer the user's message directly.
- Be concise (1-3 short sentences). Sound human and warm.
- If asked to book, share the booking link if available.
- If asked something outside your knowledge, offer to take a message or hand off.`;

    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: system }, ...data.messages],
        }),
      });

      if (!aiRes.ok) {
        if (aiRes.status === 429)
          return { success: false as const, error: "Too many requests. Try again in a minute." };
        if (aiRes.status === 402)
          return { success: false as const, error: "AI credits exhausted. Add credits in Workspace settings." };
        const t = await aiRes.text();
        console.error("AI gateway error:", aiRes.status, t);
        return { success: false as const, error: "AI chat failed." };
      }

      const json = await aiRes.json();
      const reply = json.choices?.[0]?.message?.content as string | undefined;
      if (!reply) return { success: false as const, error: "AI returned no reply." };
      return { success: true as const, reply };
    } catch (e) {
      console.error("chatWithAgent error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Unexpected error during chat.",
      };
    }
  });
