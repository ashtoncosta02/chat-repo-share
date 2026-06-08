import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkFreeBusy, createEvent } from "@/server/google-calendar.server";

export const CHAT_TOOLS = [
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

export async function runChatTool(
  agentId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
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

export async function getCalendarInfoForAgent(agentId: string) {
  const { data: cal } = await supabaseAdmin
    .from("agent_google_calendar")
    .select("timezone")
    .eq("agent_id", agentId)
    .maybeSingle();
  return cal;
}
