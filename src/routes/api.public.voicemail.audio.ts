import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EL_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

export const Route = createFileRoute("/api/public/voicemail/audio")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const leadId = url.searchParams.get("lead") || "";
          const agentElId = url.searchParams.get("agent") || "";

          const apiKey = process.env.ELEVENLABS_API_KEY;
          if (!apiKey) return new Response("Missing API key", { status: 500 });

          const { data: lead } = await supabaseAdmin
            .from("leads")
            .select("name")
            .eq("id", leadId)
            .maybeSingle();
          const { data: agent } = await supabaseAdmin
            .from("agents")
            .select("business_name, assistant_name, voice_id")
            .eq("elevenlabs_agent_id", agentElId)
            .maybeSingle();

          const firstName = (lead?.name ?? "").trim().split(/\s+/)[0] || "there";
          const receptionistName = (agent?.assistant_name || "the receptionist").trim();
          const businessName = (agent?.business_name || "the business").trim();
          const voiceId = agent?.voice_id || DEFAULT_VOICE_ID;

          const text = `Hi ${firstName}, this is ${receptionistName} from ${businessName}. I'm calling to follow up on your earlier inquiry. Please call us back when you have a chance. Thank you, goodbye.`;

          // Twilio <Play> needs telephony-friendly audio. μ-law 8kHz WAV works.
          const ttsRes = await fetch(
            `${EL_BASE}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=ulaw_8000`,
            {
              method: "POST",
              headers: {
                "xi-api-key": apiKey,
                "Content-Type": "application/json",
                Accept: "audio/basic",
              },
              body: JSON.stringify({
                text,
                model_id: "eleven_turbo_v2_5",
                voice_settings: { stability: 0.6, similarity_boost: 0.8, speed: 1.0 },
              }),
            },
          );
          if (!ttsRes.ok) {
            const errText = await ttsRes.text();
            console.error("ElevenLabs TTS failed:", ttsRes.status, errText);
            return new Response("TTS failed", { status: 502 });
          }

          const ulaw = new Uint8Array(await ttsRes.arrayBuffer());
          const wav = wrapUlawAsWav(ulaw, 8000);

          return new Response(wav, {
            headers: {
              "Content-Type": "audio/wav",
              "Cache-Control": "no-store",
            },
          });
        } catch (e) {
          console.error("voicemail audio error:", e);
          return new Response("Error", { status: 500 });
        }
      },
    },
  },
});

// Wrap raw μ-law 8kHz mono in a WAV container (format code 7) so Twilio <Play> accepts it.
function wrapUlawAsWav(ulaw: Uint8Array, sampleRate: number): Uint8Array {
  const dataLen = ulaw.length;
  const buffer = new ArrayBuffer(44 + dataLen);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLen, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 7, true); // format = μ-law
  view.setUint16(22, 1, true); // channels
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate (1 byte per sample)
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataLen, true);
  new Uint8Array(buffer, 44).set(ulaw);
  return new Uint8Array(buffer);
}
