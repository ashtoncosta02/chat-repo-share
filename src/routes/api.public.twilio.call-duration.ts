import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyTwilioSignature, formDataToRecord } from "@/server/twilio-signature.server";

export const Route = createFileRoute("/api/public/twilio/call-duration")({ server:{handlers:{POST:async ({request})=>{
  const form = await request.formData();
  if (!await verifyTwilioSignature(request,formDataToRecord(form))) return new Response("Unauthorized",{status:403});
  const id = new URL(request.url).searchParams.get("reservation");
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) return new Response("Invalid reservation",{status:400});
  const seconds = Math.max(0,parseInt(String(form.get("DialCallDuration") ?? "0"),10)||0);
  const { error } = await supabaseAdmin.from("call_allowance_ledger").update({actual_seconds:seconds,finalized_at:new Date().toISOString()}).eq("id",id);
  if (error) return new Response("Unable to record call",{status:500});
  return new Response("<Response><Hangup /></Response>",{headers:{"Content-Type":"application/xml"}});
}}}});