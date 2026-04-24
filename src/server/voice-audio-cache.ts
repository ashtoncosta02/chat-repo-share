/**
 * In-memory cache mapping short ids → { text, voiceId } pairs.
 *
 * Used by the inbound voice flow to avoid the round-trip of uploading
 * each TTS clip to Supabase Storage. Instead we register the text,
 * hand Twilio a URL like /api/public/voice/audio/<id>.mp3, and stream
 * ElevenLabs straight through when Twilio fetches it.
 *
 * Entries auto-expire after 2 minutes — Twilio always fetches the
 * audio within seconds of the TwiML response, so anything older is
 * stale and safe to drop.
 *
 * Note: this lives in module scope, which means each Worker isolate
 * has its own copy. That's fine because Twilio fetches the audio URL
 * within the same call's connection window, almost always hitting the
 * same isolate that just generated the TwiML response.
 */

type Entry = { text: string; voiceId: string | null; expiresAt: number };

const TTL_MS = 2 * 60 * 1000;
const cache = new Map<string, Entry>();

function sweep() {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expiresAt < now) cache.delete(k);
  }
}

export function registerAudio(text: string, voiceId: string | null): string {
  sweep();
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  cache.set(id, { text, voiceId, expiresAt: Date.now() + TTL_MS });
  return id;
}

export function consumeAudio(id: string): { text: string; voiceId: string | null } | null {
  const entry = cache.get(id);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(id);
    return null;
  }
  // Don't delete — Twilio sometimes retries/refetches.
  return { text: entry.text, voiceId: entry.voiceId };
}
