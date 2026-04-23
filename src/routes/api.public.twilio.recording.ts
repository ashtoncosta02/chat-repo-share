import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Twilio RecordingStatusCallback webhook.
 *
 * Twilio POSTs here when a call recording finishes processing.
 * Form fields we care about:
 *   - RecordingStatus: "completed" | "failed" | "absent"
 *   - RecordingUrl:    https://api.twilio.com/...../Recordings/REabc...
 *                      (append .mp3 to fetch the audio)
 *   - RecordingSid:    REabc...
 *   - RecordingDuration: seconds
 *
 * We download the MP3 (auth'd via the Twilio connector gateway), upload
 * it to the public `call-audio` bucket, and store the public URL +
 * duration on the conversation row identified by the `cid` query param.
 */
export const Route = createFileRoute("/api/public/twilio/recording")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const conversationId = url.searchParams.get("cid") || "";
          if (!conversationId) {
            return new Response("missing cid", { status: 400 });
          }

          const form = await request.formData();
          const status = String(form.get("RecordingStatus") || "");
          const recordingUrl = String(form.get("RecordingUrl") || "");
          const recordingSid = String(form.get("RecordingSid") || "");
          const durationStr = String(form.get("RecordingDuration") || "0");
          const duration = parseInt(durationStr, 10) || 0;

          if (status !== "completed" || !recordingUrl) {
            console.warn("recording webhook: skipping", { status, recordingUrl });
            return new Response("ok");
          }

          // Twilio's RecordingUrl needs basic auth via the gateway. Use the
          // Twilio Account SID + auth token through the connector gateway.
          // The MP3 lives at `${RecordingUrl}.mp3`.
          const lovableKey = process.env.LOVABLE_API_KEY;
          const twilioKey = process.env.TWILIO_API_KEY;
          if (!lovableKey || !twilioKey) {
            console.error("recording: missing connector keys");
            return new Response("ok");
          }

          // The public Recording URL on api.twilio.com requires HTTP Basic
          // auth. We don't have the raw Account SID/secret here — we have
          // the connector gateway. Recordings ARE accessible via the
          // gateway: /Recordings/{Sid}.mp3 returns the audio.
          const gatewayUrl = `https://connector-gateway.lovable.dev/twilio/Recordings/${encodeURIComponent(
            recordingSid,
          )}.mp3`;

          const audioRes = await fetch(gatewayUrl, {
            headers: {
              Authorization: `Bearer ${lovableKey}`,
              "X-Connection-Api-Key": twilioKey,
            },
          });

          if (!audioRes.ok) {
            console.error(
              "recording: download failed",
              audioRes.status,
              await audioRes.text(),
            );
            return new Response("ok");
          }

          const buf = new Uint8Array(await audioRes.arrayBuffer());
          const objectName = `recordings/${conversationId}-${recordingSid}.mp3`;

          const { error: upErr } = await supabaseAdmin.storage
            .from("call-audio")
            .upload(objectName, buf, {
              contentType: "audio/mpeg",
              cacheControl: "3600",
              upsert: true,
            });
          if (upErr) {
            console.error("recording: storage upload failed", upErr);
            return new Response("ok");
          }

          const { data: pub } = supabaseAdmin.storage
            .from("call-audio")
            .getPublicUrl(objectName);

          await supabaseAdmin
            .from("conversations")
            .update({
              recording_url: pub.publicUrl,
              duration_seconds: duration,
              ended_at: new Date().toISOString(),
            })
            .eq("id", conversationId);

          return new Response("ok");
        } catch (e) {
          console.error("recording webhook error:", e);
          return new Response("ok");
        }
      },
    },
  },
});
