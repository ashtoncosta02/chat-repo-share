import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TtsInput = z.object({
  text: z.string().min(1).max(2000),
  voiceId: z.string().min(1).max(64).optional(),
});

// Default voice: "Sarah" — warm, friendly female receptionist
const DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL";

export const speakText = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TtsInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return { success: false as const, error: "Voice service is not configured." };
    }
    try {
      const voiceId = data.voiceId || DEFAULT_VOICE;
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: data.text,
            model_id: "eleven_turbo_v2_5",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.3,
              use_speaker_boost: true,
            },
          }),
        },
      );
      if (!res.ok) {
        const t = await res.text();
        console.error("ElevenLabs TTS error:", res.status, t);
        return { success: false as const, error: `Voice generation failed (${res.status}).` };
      }
      const buf = await res.arrayBuffer();
      const audioBase64 = Buffer.from(buf).toString("base64");
      return { success: true as const, audioBase64 };
    } catch (e) {
      console.error("speakText error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Unexpected voice error.",
      };
    }
  });

const SttInput = z.object({
  audioBase64: z.string().min(1).max(20_000_000),
  mimeType: z.string().min(1).max(100),
});

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SttInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return { success: false as const, error: "Voice service is not configured." };
    }
    try {
      const bytes = Buffer.from(data.audioBase64, "base64");
      const blob = new Blob([bytes], { type: data.mimeType });
      const fd = new FormData();
      fd.append("file", blob, `audio.${data.mimeType.split("/")[1] || "webm"}`);
      fd.append("model_id", "scribe_v2");
      fd.append("language_code", "eng");

      const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: { "xi-api-key": apiKey },
        body: fd,
      });
      if (!res.ok) {
        const t = await res.text();
        console.error("ElevenLabs STT error:", res.status, t);
        return { success: false as const, error: `Transcription failed (${res.status}).` };
      }
      const json = await res.json();
      const text = (json.text as string | undefined)?.trim() || "";
      return { success: true as const, text };
    } catch (e) {
      console.error("transcribeAudio error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Unexpected transcription error.",
      };
    }
  });
