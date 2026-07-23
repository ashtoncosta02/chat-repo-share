import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registerTwilioCall } from "@/server/elevenlabs-agent.server";
import { verifyTwilioSignature, formDataToRecord } from "@/server/twilio-signature.server";

const PROJECT_ID = "d1e796ad-671c-47e1-843b-cdecc02fe11f";

export const Route = createFileRoute("/api/public/twilio/voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const params = formDataToRecord(form);
          if (!(await verifyTwilioSignature(request, params))) {
            return new Response("Invalid signature", { status: 403 });
          }
          const from = String(form.get("From") || "").trim();
          const to = String(form.get("To") || "").trim();
          if (!from || !to) return voiceMessage("Sorry, this number is not connected yet.");

          const { data: phoneRow } = await supabaseAdmin
            .from("phone_numbers")
            .select("agent_id")
            .eq("phone_number", to)
            .maybeSingle();
          if (!phoneRow?.agent_id) return voiceMessage("Sorry, this number is not connected yet.");

          // Look up the agent owner so we can check the blocked-caller list.
          const { data: agentOwner } = await supabaseAdmin
            .from("agents")
            .select("user_id")
            .eq("id", phoneRow.agent_id)
            .maybeSingle();
          if (agentOwner?.user_id) {
            const fromD = digitsOnly(from);
            const { data: blocks } = await supabaseAdmin
              .from("blocked_callers")
              .select("phone")
              .eq("user_id", agentOwner.user_id);
            const isBlocked = (blocks ?? []).some((b) =>
              samePhone(fromD, String(b.phone || "")),
            );
            if (isBlocked) {
              return new Response(`<Response><Reject reason="busy" /></Response>`, {
                headers: { "Content-Type": "application/xml" },
              });
            }
          }

          const { data: agent } = await supabaseAdmin
            .from("agents")
            .select("id, user_id, elevenlabs_agent_id, answer_mode")
            .eq("id", phoneRow.agent_id)
            .maybeSingle();
          if (!agent?.elevenlabs_agent_id) return voiceMessage("Sorry, the receptionist is unavailable right now.");

          // Fetch owner_forward_phone separately (not yet in generated types).
          const { data: fwdRow } = await supabaseAdmin
            .from("agents")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .select("owner_forward_phone" as any)
            .eq("id", phoneRow.agent_id)
            .maybeSingle();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const forward = String((fwdRow as any)?.owner_forward_phone || "").trim();
          const mode = String(agent.answer_mode || "immediate");
          if (mode === "after_4_rings" && forward) {
            const fallbackUrl =
              `https://project--${PROJECT_ID}-dev.lovable.app/api/public/twilio/voice-fallback` +
              `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
            const safeForward = escapeXml(forward);
            const safeAction = escapeXml(fallbackUrl);
            const safeCallerId = escapeXml(from);
            // timeout=20 ≈ 4 rings — short enough to beat most carrier voicemails (~25s).
            // machineDetection detects voicemail; if AnsweredBy is a machine, the fallback
            // route hangs up the owner leg and routes the caller to the AI receptionist.
            const twiml =
              `<?xml version="1.0" encoding="UTF-8"?><Response>` +
              `<Dial timeout="20" answerOnBridge="true" callerId="${safeCallerId}" ` +
              `action="${safeAction}" method="POST" ` +
              `machineDetection="Enable" machineDetectionTimeout="8">` +
              `<Number>${safeForward}</Number>` +
              `</Dial>` +
              `</Response>`;
            return new Response(twiml, { headers: { "Content-Type": "application/xml" } });
          }

          const fromDigits = digitsOnly(from);
          const { data: leadRows } = await supabaseAdmin
            .from("leads")
            .select("name, phone, notes")
            .eq("agent_id", agent.id)
            .eq("user_id", agent.user_id)
            .order("created_at", { ascending: false })
            .limit(200);
          const lead = (leadRows || []).find((row) => samePhone(fromDigits, String(row.phone || "")));

          const firstName = (lead?.name ?? "").trim().split(/\s+/)[0] ?? "";
          const twiml = await registerTwilioCall({
            agentId: agent.elevenlabs_agent_id,
            fromNumber: from,
            toNumber: to,
            direction: "inbound",
            dynamicVariables: {
              call_direction: "inbound",
              lead_name: firstName,
              lead_notes: (lead?.notes ?? "").slice(0, 500),
            },
          });

          return new Response(twiml, { headers: { "Content-Type": "application/xml" } });
        } catch (e) {
          console.error("Twilio voice webhook error:", e);
          return voiceMessage("Sorry, an application error occurred. Goodbye.");
        }
      },
    },
  },
});

function voiceMessage(message: string) {
  const safe = escapeXml(message);
  return new Response(`<Response><Say>${safe}</Say><Hangup /></Response>`, {
    headers: { "Content-Type": "application/xml" },
  });
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
}

function digitsOnly(phone: string) {
  return phone.replace(/\D/g, "");
}

function samePhone(aDigits: string, bPhone: string) {
  const bDigits = digitsOnly(bPhone);
  return Boolean(aDigits && bDigits && (aDigits.endsWith(bDigits) || bDigits.endsWith(aDigits)));
}
