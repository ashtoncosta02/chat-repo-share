import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registerTwilioCall } from "@/server/elevenlabs-agent.server";

export const Route = createFileRoute("/api/public/twilio/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const leadId = url.searchParams.get("lead") || "";
          const agentId = url.searchParams.get("agent") || "";
          const form = await request.formData();
          const answeredBy = String(form.get("AnsweredBy") || "").toLowerCase();
          const from = String(form.get("From") || "").trim();
          const to = String(form.get("To") || "").trim();

          const { data: lead } = await supabaseAdmin
            .from("leads")
            .select("id, name, phone, notes")
            .eq("id", leadId)
            .maybeSingle();
          const { data: agent } = await supabaseAdmin
            .from("agents")
            .select("business_name, assistant_name")
            .eq("elevenlabs_agent_id", agentId)
            .maybeSingle();

          if (!lead || !agent || !from || !to) {
            return voiceMessage("Sorry, this callback is unavailable right now.");
          }

          const firstName = (lead.name ?? "").trim().split(/\s+/)[0] || "there";
          const receptionistName = (agent.assistant_name || "the receptionist").trim();
          const businessName = (agent.business_name || "the business").trim();
          const voicemailMessage = `Hi ${firstName}, this is ${receptionistName} from ${businessName}. I'm calling to follow up on your earlier inquiry. Please call us back when you have a chance. Thank you, goodbye.`;

          if (answeredBy.startsWith("machine") || answeredBy === "fax" || answeredBy === "unknown") {
            const audioUrl = `https://project--d1e796ad-671c-47e1-843b-cdecc02fe11f-dev.lovable.app/api/public/voicemail/audio?lead=${encodeURIComponent(leadId)}&agent=${encodeURIComponent(agentId)}`;
            return new Response(
              `<Response><Play>${escapeXml(audioUrl)}</Play><Hangup /></Response>`,
              { headers: { "Content-Type": "application/xml" } },
            );
          }

          const twiml = await registerTwilioCall({
            agentId,
            fromNumber: from,
            toNumber: to,
            direction: "outbound",
            firstMessage: `Hi ${firstName}, this is ${receptionistName} from ${businessName} — I'm following up on your earlier inquiry, is now a good time?`,
            dynamicVariables: {
              call_direction: "outbound",
              lead_name: firstName === "there" ? "" : firstName,
              lead_notes: (lead.notes ?? "").slice(0, 500),
            },
          });

          return new Response(twiml, { headers: { "Content-Type": "application/xml" } });
        } catch (e) {
          console.error("Twilio callback webhook error:", e);
          return voiceMessage("Sorry, an application error occurred. Goodbye.");
        }
      },
    },
  },
});

function voiceMessage(message: string) {
  return new Response(`<Response><Say>${escapeXml(message)}</Say><Hangup /></Response>`, {
    headers: { "Content-Type": "application/xml" },
  });
}

function escapeXml(message: string) {
  return message.replace(/[<>&'"]/g, (c) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  })[c] || c);
}