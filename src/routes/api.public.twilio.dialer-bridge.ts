import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { planEnvironment } from "@/server/plan-access.server";
import { reservationUsage } from "@/server/call-usage.server";
import { DIALER_CALL_MAX_SECONDS, RESERVATION_SLOT_SECONDS, callMaxSeconds } from "@/lib/call-length";

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

  // The signed destination binds ownership; atomically reserve a small slot for
  // the connected leg, then let Twilio cap the call at the minutes left (up to
  // 4 hours). The real duration is recorded by the call-duration callback.
  const { data: owner } = await supabaseAdmin.from("phone_numbers").select("user_id").eq("phone_number",from).maybeSingle();
  if (!owner) return twiml("Receptionist unavailable.");
  const { data, error } = await supabaseAdmin.rpc("reserve_call_allowance", { p_user:owner.user_id, p_env:planEnvironment(), p_call_key:`dialer:${sig}`,p_max_seconds:RESERVATION_SLOT_SECONDS });
  const allowance = data as { seconds?:number;reservation_id?:string;plan_id?:string } | null;
  if (error || !allowance?.seconds || !allowance.reservation_id) return twiml("Monthly call allowance reached. Please contact the business another way.");
  const usage = await reservationUsage(owner.user_id, allowance.reservation_id, allowance.plan_id);
  const timeLimit = callMaxSeconds(allowance.seconds, DIALER_CALL_MAX_SECONDS, usage);
  const action = escapeXml(`https://askjanice.net/api/public/twilio/call-duration?reservation=${allowance.reservation_id}`);

  const safeTo = escapeXml(to);
  const safeFrom = escapeXml(from);
  const body = `<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${safeFrom}" answerOnBridge="true" timeout="30" timeLimit="${timeLimit}" action="${action}" method="POST"><Number>${safeTo}</Number></Dial></Response>`;
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
