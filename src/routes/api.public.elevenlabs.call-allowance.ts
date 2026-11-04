import { createFileRoute } from "@tanstack/react-router";
import { callAllowanceCredential, reserveAgentCall } from "@/server/call-usage.server";

export const Route = createFileRoute("/api/public/elevenlabs/call-allowance")({
  server: { handlers: { GET: () => Response.json({ call_allowance_ready: true }), POST: async ({ request }) => {
    try {
      const input = await request.json() as { agent_id?: string; conversation_id?: string; call_sid?: string };
      if (!input.agent_id || !input.conversation_id) return new Response("Invalid call", { status: 400 });
      const expected = await callAllowanceCredential(input.agent_id);
      const received = request.headers.get("x-janice-call-allowance") ?? "";
      let diff = received.length ^ expected.length;
      for (let i=0;i<expected.length;i++) diff |= expected.charCodeAt(i) ^ (received.charCodeAt(i) || 0);
      if (diff !== 0) return new Response("Unauthorized", { status: 403 });
      const reservation = await reserveAgentCall(input.agent_id, `el:${input.conversation_id}`);
      return Response.json({ type: "conversation_initiation_client_data", conversation_config_override: { conversation: { max_duration_seconds: reservation.seconds } }, dynamic_variables: { janice_call_reservation: reservation.reservationId } });
    } catch {
      // Fail closed instead of starting an unmetered call.
      return new Response("Call allowance unavailable", { status: 403 });
    }
  } } },
});