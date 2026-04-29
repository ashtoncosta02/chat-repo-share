import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkFreeBusy, createEvent } from "./google-calendar.server";

const ChatInput = z.object({
  agent: z.object({
    id: z.string().uuid().optional(),
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

const TOOLS = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Check the business calendar for busy times in a date range. Use before suggesting meeting slots. Returns busy intervals; gaps are available.",
      parameters: {
        type: "object",
        properties: {
          start_iso: {
            type: "string",
            description: "Start of search window in ISO 8601 with timezone, e.g. 2026-04-30T09:00:00-04:00",
          },
          end_iso: {
            type: "string",
            description: "End of search window in ISO 8601 with timezone.",
          },
        },
        required: ["start_iso", "end_iso"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_meeting",
      description:
        "Book a meeting on the business calendar. Confirm the time, attendee name and email with the user before calling this.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Short event title, e.g. 'Consultation with John Doe'" },
          description: { type: "string", description: "Notes / details for the event" },
          start_iso: { type: "string", description: "Event start ISO 8601 with timezone" },
          end_iso: { type: "string", description: "Event end ISO 8601 with timezone" },
          attendee_email: { type: "string", description: "Customer's email address" },
          attendee_name: { type: "string", description: "Customer's full name" },
        },
        required: ["summary", "start_iso", "end_iso", "attendee_email", "attendee_name"],
        additionalProperties: false,
      },
    },
  },
];

async function runTool(agentId: string, name: string, args: Record<string, unknown>): Promise<string> {
  try {
    if (name === "check_availability") {
      const r = await checkFreeBusy(agentId, String(args.start_iso), String(args.end_iso));
      return JSON.stringify(r);
    }
    if (name === "book_meeting") {
      const r = await createEvent(agentId, {
        summary: String(args.summary),
        description: args.description ? String(args.description) : undefined,
        start: String(args.start_iso),
        end: String(args.end_iso),
        attendeeEmail: String(args.attendee_email),
        attendeeName: String(args.attendee_name),
      });
      if ("error" in r) return JSON.stringify({ ok: false, error: r.error });
      return JSON.stringify({ ok: true, event_id: r.id, link: r.htmlLink });
    }
    return JSON.stringify({ error: `Unknown tool ${name}` });
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : "tool error" });
  }
}

export const chatWithAgent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ChatInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { success: false as const, error: "AI service is not configured." };
    }

    const a = data.agent;
    const name = a.assistant_name || "Ava";

    // Check if this agent has a connected calendar
    let calendarConnected = false;
    let calendarTimezone = "America/New_York";
    if (a.id) {
      const { data: cal } = await supabaseAdmin
        .from("agent_google_calendar")
        .select("timezone")
        .eq("agent_id", a.id)
        .maybeSingle();
      if (cal) {
        calendarConnected = true;
        calendarTimezone = cal.timezone;
      }
    }

    const nowIso = new Date().toISOString();
    const bookingInstructions = calendarConnected
      ? `\n\nCalendar booking is ENABLED. You have two tools:
- check_availability(start_iso, end_iso): inspect busy times before suggesting slots.
- book_meeting(...): create the event after confirming details.

Booking flow:
1. When the user wants to book, ask for their preferred day/time, full name, and email.
2. Call check_availability for that day to see busy intervals.
3. Suggest 1-3 free slots inside business hours.
4. Once they confirm a slot AND you have name + email, call book_meeting.
5. After booking succeeds, confirm the time and tell them they'll get a calendar invite by email.

The current time is ${nowIso}. The business timezone is ${calendarTimezone}. All ISO times you pass to tools must include the timezone offset.`
      : a.booking_link
        ? `\n\nFor bookings, share the booking link: ${a.booking_link}`
        : `\n\nYou cannot book meetings — offer to take the customer's name and contact info instead.`;

    const system = `You are ${name}, a warm and professional AI receptionist for ${a.business_name}${a.industry ? ` (${a.industry})` : ""}.

Tone: ${a.tone || "warm, friendly, professional"}.
Primary goal: ${a.primary_goal || "Help callers with information and booking."}

Services:
${a.services || "(none provided)"}

FAQs:
${a.faqs || "(none provided)"}

Pricing notes:
${a.pricing_notes || "(none provided)"}

Emergency / handoff number: ${a.emergency_number || "(none)"}
Escalate to a human if: ${a.escalation_triggers || "(use judgment)"}${bookingInstructions}

Rules:
- The opening greeting has already been delivered. Do NOT introduce yourself again, do NOT say your name again, and do NOT say "this is ${name}" or "I'm ${name}" in any follow-up reply. Just answer the user's message directly.
- Be concise (1-3 short sentences). Sound human and warm.
- If asked something outside your knowledge, offer to take a message or hand off.`;

    try {
      // Tool-calling loop (max 4 rounds)
      const messages: Array<Record<string, unknown>> = [
        { role: "system", content: system },
        ...data.messages,
      ];

      for (let round = 0; round < 4; round++) {
        const body: Record<string, unknown> = {
          model: "google/gemini-3-flash-preview",
          messages,
        };
        if (calendarConnected && a.id) {
          body.tools = TOOLS;
        }

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
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
        const msg = json.choices?.[0]?.message;
        if (!msg) return { success: false as const, error: "AI returned no reply." };

        const toolCalls = msg.tool_calls;
        if (toolCalls && toolCalls.length > 0 && a.id) {
          // Append assistant message with tool calls
          messages.push({
            role: "assistant",
            content: msg.content ?? "",
            tool_calls: toolCalls,
          });
          // Execute each tool
          for (const tc of toolCalls) {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.function.arguments || "{}");
            } catch {
              // ignore
            }
            const result = await runTool(a.id, tc.function.name, args);
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: result,
            });
          }
          continue; // Next round, let AI use tool results
        }

        const reply = msg.content as string | undefined;
        if (!reply) return { success: false as const, error: "AI returned no reply." };
        return { success: true as const, reply };
      }

      return { success: false as const, error: "Booking conversation took too many turns." };
    } catch (e) {
      console.error("chatWithAgent error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Unexpected error during chat.",
      };
    }
  });
