// Public webhook called by the ElevenLabs voice agent during a call to book a
// confirmed appointment. The agent must have already called find-slots and
// collected the caller's name + phone number.
// Request body: {
//   agent_id, start_iso, customer_name, customer_phone,
//   duration_minutes?, customer_email?, reason?, conversation_id?
// }
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { bookAppointment } from "@/server/widget-booking-tools";

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

interface BookBody {
  agent_id?: string;
  start_iso?: string;
  duration_minutes?: number;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  reason?: string;
  conversation_id?: string;
}

export const Route = createFileRoute("/api/public/voice-tools/book-appointment")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        let body: BookBody;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400);
        }

        const agentId = body.agent_id?.trim();
        if (!agentId) return jsonResponse({ ok: false, error: "agent_id required" }, 400);

        // Look up the owning user for the agent (needed for RLS-bypassing insert).
        const { data: agent, error: agentErr } = await supabaseAdmin
          .from("agents")
          .select("user_id")
          .eq("id", agentId)
          .maybeSingle();

        if (agentErr || !agent) {
          return jsonResponse({ ok: false, error: "Unknown agent" }, 404);
        }

        const result = await bookAppointment({
          agentId,
          userId: agent.user_id,
          conversationId: body.conversation_id || null,
          source: "voice",
          args: {
            start_iso: body.start_iso || "",
            duration_minutes: body.duration_minutes,
            customer_name: body.customer_name || "",
            customer_email: body.customer_email || "",
            customer_phone: body.customer_phone || "",
            reason: body.reason,
          },
        });

        if ("error" in result) {
          return jsonResponse({ ok: false, error: result.error });
        }

        // Voice-friendly confirmation the agent can read back to the caller.
        return jsonResponse({
          ok: true,
          booking_id: result.booking_id,
          start_iso: result.start,
          end_iso: result.end,
          message: "Appointment booked successfully.",
        });
      },
    },
  },
});
