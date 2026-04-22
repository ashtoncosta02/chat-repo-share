import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TtsInput = z.object({
  text: z.string().min(1).max(2000),
  voiceId: z.string().min(1).max(64).optional(),
});

// Default voice: "Sarah" — warm, friendly female receptionist
const DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL";

/**
 * Pre-process text before sending to ElevenLabs so URLs and special
 * characters get pronounced naturally instead of glitching out.
 *
 * ElevenLabs reads "/" inconsistently (often as a glitchy "slash" or
 * dropped sound), and reads URLs character-by-character. We rewrite
 * common patterns into spoken English so the audio sounds clean.
 */
export function prepareForTts(input: string): string {
  let text = input;

  // Strip markdown that shouldn't be spoken
  text = text.replace(/\*\*(.+?)\*\*/g, "$1");
  text = text.replace(/\*(.+?)\*/g, "$1");
  text = text.replace(/`([^`]+)`/g, "$1");

  // Convert markdown links [label](url) -> just the label
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");

  // Spell out URLs as natural speech: "example dot com slash booking"
  text = text.replace(/https?:\/\/(\S+)/gi, (_m, rest: string) => urlToSpeech(rest));
  text = text.replace(/\bwww\.(\S+)/gi, (_m, rest: string) => urlToSpeech(rest));

  // Any remaining bare slashes (e.g. "9am/5pm" or "and/or") become " or "
  // — more natural than the literal word "slash" which TTS engines
  // tend to mispronounce or skip entirely.
  text = text.replace(/\s*\/\s*/g, " or ");

  // Collapse extra whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function urlToSpeech(rest: string): string {
  // Trim trailing punctuation like ).,! that's not part of the URL
  const cleaned = rest.replace(/[)\].,!?;:]+$/, "");
  return cleaned
    .replace(/\./g, " dot ")
    .replace(/\//g, " forward slash ")
    .replace(/-/g, " dash ")
    .replace(/_/g, " underscore ")
    .replace(/\s+/g, " ")
    .trim();
}

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
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_22050_32`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: prepareForTts(data.text),
            model_id: "eleven_turbo_v2",
            voice_settings: {
              stability: 0.45,
              similarity_boost: 0.7,
              style: 0.2,
              use_speaker_boost: true,
              speed: 1.08,
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
