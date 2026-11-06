import { createFileRoute } from "@tanstack/react-router";
import { callAllowanceCredential, reserveAgentCall, AllowanceDeniedError } from "@/server/call-usage.server";
import { allowanceResponseBody, type AllowanceOutcome } from "@/lib/call-allowance-decision";

type Input = { agent_id?: string; conversation_id?: string; call_sid?: string; caller_id?: string };

function respond(outcome: AllowanceOutcome) {
  const r = allowanceResponseBody(outcome);
  return typeof r.body === "string" ? new Response(r.body, { status: r.status }) : Response.json(r.body, { status: r.status });
}

// Our own problems must never drop a real caller: log and alert (max 1/hour).
async function alertAllowedAnyway(kind: string, detail: unknown) {
  console.error(`call-allowance: allowing call despite ${kind}`, detail);
  try {
    const { allowRequestStrict } = await import("@/server/rate-limit.server");
    if (!(await allowRequestStrict("call-allowance-alert", 1, 3600))) return;
    const { sendEmail } = await import("@/server/email.server");
    const safe = String(kind).replace(/[&<>"']/g, "");
    await sendEmail({
      to: "hello@askjanice.net",
      subject: "Janice alert: minutes check let a call through",
      html: `<p>The inbound minutes check hit a problem (<strong>${safe}</strong>) and let the call through with a 10-minute cap instead of rejecting it. Check the server logs.</p>`,
    });
  } catch (e) {
    console.error("call-allowance: alert failed", e);
  }
}

function sameCredential(received: string, expected: string) {
  let diff = received.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (received.charCodeAt(i) || 0);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/elevenlabs/call-allowance")({
  server: { handlers: { GET: () => Response.json({ call_allowance_ready: true }), POST: async ({ request }) => {
    let input: Input;
    try {
      input = (await request.json()) as Input;
    } catch (e) {
      await alertAllowedAnyway("bad-json", e);
      return respond({ kind: "bad-request" });
    }
    if (!input?.agent_id || !input.conversation_id) {
      await alertAllowedAnyway("missing-fields", null);
      return respond({ kind: "bad-request" });
    }
    try {
      const expected = await callAllowanceCredential(input.agent_id);
      if (!sameCredential(request.headers.get("x-janice-call-allowance") ?? "", expected)) {
        // Unverified: write nothing, skip the blocked-caller lookup.
        await alertAllowedAnyway("bad-credential", null);
        return respond({ kind: "bad-credential" });
      }
    } catch (e) {
      await alertAllowedAnyway("credential-error", e);
      return respond({ kind: "error" });
    }

    let ownerId: string | null = null;
    let agentDbId: string | null = null;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: owner } = await supabaseAdmin.from("agents").select("id, user_id").eq("elevenlabs_agent_id", input.agent_id).maybeSingle();
      ownerId = owner?.user_id ?? null;
      agentDbId = owner?.id ?? null;
      if (input.caller_id && ownerId) {
        const { isBlockedCaller } = await import("@/server/blocked-callers.server");
        if (await isBlockedCaller(ownerId, input.caller_id)) return respond({ kind: "blocked" });
      }
    } catch (e) {
      console.error("call-allowance: owner/blocked lookup failed", e);
    }

    try {
      const reservation = await reserveAgentCall(input.agent_id, `el:${input.conversation_id}`);
      return respond({ kind: "reserved", seconds: reservation.seconds, reservationId: reservation.reservationId });
    } catch (e) {
      if (e instanceof AllowanceDeniedError) {
        if (agentDbId && ownerId && input.caller_id) {
          const { saveMissedCaller } = await import("@/server/lead-extraction");
          await saveMissedCaller({ agentId: agentDbId, userId: ownerId, callerNumber: input.caller_id, reason: e.message || "call allowance reached" });
        }
        return respond({ kind: "denied" });
      }
      await alertAllowedAnyway("reservation-error", e);
      return respond({ kind: "error" });
    }
  } } },
});
