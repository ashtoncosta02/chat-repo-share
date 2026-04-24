import { createFileRoute } from "@tanstack/react-router";
import { consumeAudio } from "@/server/voice-audio-cache";
import { prepareForTts } from "@/server/agent-voice";

/**
 * Public audio streaming endpoint for inbound voice calls.
 *
 * Twilio's <Play> verb fetches a URL like
 *   /api/public/voice/audio/<id>.mp3
 * The id was registered server-side in voice-audio-cache when we
 * generated the TwiML. We look up the text+voice, ask ElevenLabs
 * for the audio, and stream the MP3 bytes straight through to
 * Twilio — no Supabase storage upload step.
 *
 * Why this is faster: the previous flow waited for the full MP3 to
 * download from ElevenLabs, then uploaded it to Supabase, then handed
 * Twilio a public URL to fetch. Now Twilio's first-byte time is just
 * the time to ElevenLabs' first byte (~75ms with Flash v2.5).
 */
export const Route = createFileRoute("/api/public/voice/audio/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const rawId = String(params.id || "");
        // Strip optional .mp3 extension Twilio sees in the URL.
        const id = rawId.replace(/\.mp3$/i, "");
        if (!id) return new Response("missing id", { status: 400 });

        const entry = consumeAudio(id);
        if (!entry) return new Response("expired", { status: 404 });

        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
          console.error("voice-audio: ELEVENLABS_API_KEY missing");
          return new Response("misconfigured", { status: 500 });
        }

        const safeText = prepareForTts(entry.text).slice(0, 900);
        if (!safeText) return new Response("empty", { status: 400 });

        const finalVoice = entry.voiceId || "EXAVITQu4vr4xnSDxMaL";

        try {
          // Use the /stream endpoint so ElevenLabs starts emitting bytes
          // as soon as the first chunk is synthesized.
          const ttsRes = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${finalVoice}/stream?output_format=mp3_22050_32`,
            {
              method: "POST",
              headers: {
                "xi-api-key": apiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text: safeText,
                model_id: "eleven_flash_v2_5",
                voice_settings: {
                  stability: 0.4,
                  similarity_boost: 0.7,
                  style: 0,
                  use_speaker_boost: true,
                  speed: 1.05,
                },
              }),
            },
          );

          if (!ttsRes.ok || !ttsRes.body) {
            console.error(
              "voice-audio: ElevenLabs stream failed",
              ttsRes.status,
              await ttsRes.text().catch(() => ""),
            );
            return new Response("tts failed", { status: 502 });
          }

          // Stream MP3 bytes straight to Twilio.
          return new Response(ttsRes.body, {
            status: 200,
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "no-store",
            },
          });
        } catch (e) {
          console.error("voice-audio: stream error", e);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
