import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registerTwilioCall } from "@/server/elevenlabs-agent.server";

export const Route = createFileRoute("/api/public/twilio/voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const from = String(form.get("From") || "").trim();
          const to = String(form.get("To") || "").trim();
          if (!from || !to) return voiceMessage("Sorry, this number is not connected yet.");

          const { data: phoneRow } = await supabaseAdmin
            .from("phone_numbers")
            .select("agent_id")
            .eq("phone_number", to)
            .maybeSingle();
          if (!phoneRow?.agent_id) return voiceMessage("Sorry, this number is not connected yet.");

          const { data: agent } = await supabaseAdmin
            .from("agents")
            .select("id, user_id, elevenlabs_agent_id")
            .eq("id", phoneRow.agent_id)
            .maybeSingle();
          if (!agent?.elevenlabs_agent_id) return voiceMessage("Sorry, the receptionist is unavailable right now.");

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
  const safe = message.replace(/[<>&'"]/g, (c) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  })[c] || c);
  return new Response(`<Response><Say>${safe}</Say><Hangup /></Response>`, {
    headers: { "Content-Type": "application/xml" },
  });
}

function digitsOnly(phone: string) {
  return phone.replace(/\D/g, "");
}

function samePhone(aDigits: string, bPhone: string) {
  const bDigits = digitsOnly(bPhone);
  return Boolean(aDigits && bDigits && (aDigits.endsWith(bDigits) || bDigits.endsWith(aDigits)));
}