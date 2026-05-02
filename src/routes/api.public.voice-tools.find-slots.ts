// Public webhook called by the ElevenLabs voice agent during a call to look up
// available appointment slots for a given date.
// Request body: { agent_id: string, date: "YYYY-MM-DD", duration_minutes?: number }
import { createFileRoute } from "@tanstack/react-router";
import { findAvailableSlots, getCalendarConfig } from "@/server/widget-booking-tools";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Format an ISO timestamp into something an LLM can speak naturally.
function formatSlotForVoice(iso: string, timezone: string): string {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return fmt.format(d);
}

export const Route = createFileRoute("/api/public/voice-tools/find-slots")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        let body: { agent_id?: string; date?: string; duration_minutes?: number };
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400);
        }

        const agentId = body.agent_id?.trim();
        const date = body.date?.trim();
        if (!agentId) return jsonResponse({ error: "agent_id required" }, 400);
        if (!date) return jsonResponse({ error: "date required (YYYY-MM-DD)" }, 400);

        const cfg = await getCalendarConfig(agentId);
        if (!cfg) {
          return jsonResponse({
            available: false,
            message: "This business doesn't have online booking set up. Please offer to take a message instead.",
          });
        }

        const result = await findAvailableSlots(agentId, {
          date,
          duration_minutes: body.duration_minutes,
        });

        if ("error" in result) {
          return jsonResponse({ available: false, message: result.error });
        }

        if (result.slots.length === 0) {
          return jsonResponse({
            available: false,
            date,
            timezone: result.timezone,
            message: result.message || "No open slots that day. Try a different date.",
          });
        }

        return jsonResponse({
          available: true,
          date,
          timezone: result.timezone,
          duration_minutes: result.duration_minutes,
          // Voice-friendly representation the LLM can read out loud.
          slots: result.slots.map((iso) => ({
            start_iso: iso,
            spoken: formatSlotForVoice(iso, result.timezone),
          })),
        });
      },
    },
  },
});
