import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/twilio/dialer-bridge")({
  server: {
    handlers: {
      POST: handle,
      GET: handle,
    },
  },
});

async function handle({ request }: { request: Request }) {
  const url = new URL(request.url);
  const to = url.searchParams.get("to") || "";
  const from = url.searchParams.get("from") || "";
  const exp = Number(url.searchParams.get("exp") || "0");
  const sig = url.searchParams.get("sig") || "";

  if (!to || !from || !exp || !sig) return twiml("Invalid call setup.");
  if (Date.now() > exp) return twiml("This call link has expired.");

  const secret = process.env.LOVABLE_API_KEY;
  if (!secret) return twiml("Server misconfiguration.");
  const expected = createHmac("sha256", secret).update(`${to}|${from}|${exp}`).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return twiml("Unauthorized call.");

  const safeTo = escapeXml(to);
  const safeFrom = escapeXml(from);
  const body = `<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${safeFrom}" answerOnBridge="true" timeout="30"><Number>${safeTo}</Number></Dial></Response>`;
  return new Response(body, { headers: { "Content-Type": "application/xml" } });
}

function twiml(message: string) {
  const safe = escapeXml(message);
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>${safe}</Say><Hangup/></Response>`, {
    headers: { "Content-Type": "application/xml" },
  });
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
}
