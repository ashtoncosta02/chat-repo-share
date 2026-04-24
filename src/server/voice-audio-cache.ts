import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Persistent cache mapping short ids → { text, voiceId } pairs.
 *
 * Used by the inbound voice flow to avoid uploading each TTS clip to
 * Supabase Storage. We register the text in the `voice_audio_cache`
 * table, hand Twilio a URL like /api/public/voice/audio/<id>.mp3,
 * and stream ElevenLabs straight through when Twilio fetches it.
 *
 * We use the database (not in-memory) because Cloudflare Workers
 * spin up many isolates and the audio fetch from Twilio is almost
 * always a different isolate than the one that returned the TwiML.
 *
 * The conversations cleanup cron deletes rows older than 1 hour.
 */

export async function registerAudio(
  text: string,
  voiceId: string | null,
): Promise<string> {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const { error } = await supabaseAdmin.from("voice_audio_cache").insert({
    id,
    text,
    voice_id: voiceId,
  });
  if (error) {
    console.error("voice-audio-cache: insert failed", error);
  }
  return id;
}

export async function consumeAudio(
  id: string,
): Promise<{ text: string; voiceId: string | null } | null> {
  const { data, error } = await supabaseAdmin
    .from("voice_audio_cache")
    .select("text, voice_id")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("voice-audio-cache: select failed", error);
    return null;
  }
  if (!data) return null;
  return { text: data.text, voiceId: data.voice_id };
}
