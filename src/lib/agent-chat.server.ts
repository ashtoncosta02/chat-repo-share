import { supabaseAdmin } from "@/integrations/supabase/client.server";
import * as Google from "@/server/google-calendar.server";
import * as Outlook from "@/server/outlook-calendar.server";

type Provider = "google" | "outlook";

async function getProvider(agentId: string): Promise<Provider | null> {
  const { data: g } = await supabaseAdmin
    .from("agent_google_calendar").select("id").eq("agent_id", agentId).maybeSingle();
  if (g) return "google";
  const { data: o } = await supabaseAdmin
    .from("agent_outlook_calendar").select("id").eq("agent_id", agentId).maybeSingle();
  if (o) return "outlook";
  return null;
}

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
          start_iso: { type: "string", description: "Start of search window in ISO 8601 with timezone" },
          end_iso: { type: "string", description: "End of search window in ISO 8601 with timezone." },
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
          summary: { type: "string" },
          description: { type: "string" },
          start_iso: { type: "string" },
          end_iso: { type: "string" },
          attendee_email: { type: "string" },
          attendee_name: { type: "string" },
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
    const provider = await getProvider(agentId);
    if (!provider) return JSON.stringify({ error: "No calendar connected" });

    if (name === "check_availability") {
      const r = provider === "outlook"
        ? await Outlook.checkFreeBusy(agentId, String(args.start_iso), String(args.end_iso))
        : await Google.checkFreeBusy(agentId, String(args.start_iso), String(args.end_iso));
      return JSON.stringify(r);
    }
    if (name === "book_meeting") {
      const opts = {
        summary: String(args.summary),
        description: args.description ? String(args.description) : undefined,
        start: String(args.start_iso),
        end: String(args.end_iso),
        attendeeEmail: String(args.attendee_email),
        attendeeName: String(args.attendee_name),
      };
      const r = provider === "outlook"
        ? await Outlook.createEvent(agentId, opts)
        : await Google.createEvent(agentId, opts);
      if ("error" in r) return JSON.stringify({ ok: false, error: r.error });
      return JSON.stringify({ ok: true, event_id: r.id, link: r.htmlLink });
    }
    return JSON.stringify({ error: `Unknown tool ${name}` });
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : "tool error" });
  }
}

export async function getCalendarInfoForAgent(agentId: string) {
  const { data: g } = await supabaseAdmin
    .from("agent_google_calendar").select("timezone").eq("agent_id", agentId).maybeSingle();
  if (g) return g;
  const { data: o } = await supabaseAdmin
    .from("agent_outlook_calendar").select("timezone").eq("agent_id", agentId).maybeSingle();
  return o;
}

