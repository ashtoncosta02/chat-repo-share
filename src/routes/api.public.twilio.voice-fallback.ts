import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registerTwilioCall } from "@/server/elevenlabs-agent.server";
import { verifyTwilioSignature, formDataToRecord } from "@/server/twilio-signature.server";

export const Route = createFileRoute("/api/public/twilio/voice-fallback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const params = formDataToRecord(form);
          if (!(await verifyTwilioSignature(request, params))) {
            return new Response("Invalid signature", { status: 403 });
          }

          const url = new URL(request.url);
          const from = url.searchParams.get("from") || String(form.get("From") || "");
          const to = url.searchParams.get("to") || String(form.get("To") || "");

          // DialCallStatus: completed | busy | no-answer | failed | canceled | answered
          const dialStatus = String(form.get("DialCallStatus") || "").toLowerCase();
          // DialCallDuration is "0" when the owner leg hung up before bridging
          // (e.g. whisper prompt not accepted, or owner declined). Anything > 0
          // means the two legs actually bridged and the owner spoke to the caller.
          const dialDuration = parseInt(String(form.get("DialCallDuration") || "0"), 10) || 0;
          const bridged =
            (dialStatus === "completed" || dialStatus === "answered") && dialDuration > 0;

          // The owner personally answered and bridged → end cleanly.
          if (bridged) {
            return xml(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
          }

          // Otherwise (no-answer / busy / failed / canceled / whisper-declined) → route to AI.

          const { data: phoneRow } = await supabaseAdmin
            .from("phone_numbers")
            .select("agent_id")
            .eq("phone_number", to)
            .maybeSingle();
          if (!phoneRow?.agent_id) return sayThenHangup("Sorry, no one is available right now.");

          const { data: agent } = await supabaseAdmin
            .from("agents")
            .select("id, user_id, elevenlabs_agent_id")
            .eq("id", phoneRow.agent_id)
            .maybeSingle();
          if (!agent?.elevenlabs_agent_id) return sayThenHangup("Sorry, no one is available right now.");

          const fromDigits = from.replace(/\D/g, "");
          const { data: leadRows } = await supabaseAdmin
            .from("leads")
            .select("name, phone, notes")
            .eq("agent_id", agent.id)
            .eq("user_id", agent.user_id)
            .order("created_at", { ascending: false })
            .limit(200);
          const lead = (leadRows || []).find((row) => {
            const b = String(row.phone || "").replace(/\D/g, "");
            return b && (fromDigits.endsWith(b) || b.endsWith(fromDigits));
          });
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
          return xml(twiml);
        } catch (e) {
          console.error("Twilio voice-fallback error:", e);
          return sayThenHangup("Sorry, an application error occurred. Goodbye.");
        }
      },
    },
  },
});

function xml(body: string) {
  return new Response(body, { headers: { "Content-Type": "application/xml" } });
}

function sayThenHangup(message: string) {
  const safe = message.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
  return xml(`<Response><Say>${safe}</Say><Hangup/></Response>`);
}
