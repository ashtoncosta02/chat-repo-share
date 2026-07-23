import { createFileRoute } from "@tanstack/react-router";
import { verifyTwilioSignature, formDataToRecord } from "@/server/twilio-signature.server";

// Whisper prompt played on the OWNER's leg only. Caller hears normal ringing.
// - Step 1 (default): announce caller and gather 1 digit.
// - Step "accept": if the owner pressed 1, return empty TwiML so the two legs
//   bridge. Anything else hangs up the owner leg, which causes the parent
//   Dial to fire its `action` URL (voice-fallback) with DialCallDuration=0,
//   and the AI receptionist takes over before voicemail can intercept.
export const Route = createFileRoute("/api/public/twilio/voice-whisper")({
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
          const step = url.searchParams.get("step") || "prompt";
          const caller = url.searchParams.get("caller") || "";

          if (step === "accept") {
            const digit = String(form.get("Digits") || "").trim();
            if (digit === "1") {
              // Empty response → Twilio bridges the two legs.
              return xml(`<?xml version="1.0" encoding="UTF-8"?><Response/>`);
            }
            return xml(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
          }

          const acceptUrl =
            `${url.origin}/api/public/twilio/voice-whisper` +
            `?step=accept&caller=${encodeURIComponent(caller)}`;
          const spoken = speakableCaller(caller);
          const twiml =
            `<?xml version="1.0" encoding="UTF-8"?>` +
            `<Response>` +
            `<Gather numDigits="1" timeout="8" action="${escapeXml(acceptUrl)}" method="POST">` +
            `<Say voice="Polly.Joanna">Incoming call${spoken ? ` from ${spoken}` : ""}. ` +
            `Press 1 to accept, or hang up to send to your receptionist.</Say>` +
            `</Gather>` +
            `<Hangup/>` +
            `</Response>`;
          return xml(twiml);
        } catch (e) {
          console.error("Twilio voice-whisper error:", e);
          return xml(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
        }
      },
    },
  },
});

function xml(body: string) {
  return new Response(body, { headers: { "Content-Type": "application/xml" } });
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
}

// Speak a phone number digit-by-digit so it's intelligible.
function speakableCaller(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  // Format last 10 digits as X X X, X X X, X X X X for readability.
  const last10 = digits.slice(-10);
  if (last10.length === 10) {
    const a = last10.slice(0, 3).split("").join(" ");
    const b = last10.slice(3, 6).split("").join(" ");
    const c = last10.slice(6).split("").join(" ");
    return `${a}, ${b}, ${c}`;
  }
  return digits.split("").join(" ");
}
