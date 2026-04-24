import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { prepareForTts } from "@/server/agent-voice";

/**
 * Helpers shared by the inbound voice webhook routes
 * (/api/public/twilio/voice and /api/public/twilio/voice/turn).
 *
 * Twilio's <Play> verb needs a publicly fetchable URL. We generate
 * speech with ElevenLabs, upload the MP3 to the public `call-audio`
 * bucket, and return that URL. A separate cleanup job can delete old
 * files later if needed.
 */

const PUBLIC_BUCKET = "call-audio";

/**
 * Generate speech with ElevenLabs and upload it to call-audio.
 * Returns a public URL Twilio can fetch via <Play>.
 *
 * If anything fails (no API key, ElevenLabs down, upload failed),
 * returns null and the caller should fall back to <Say>.
 */
export async function synthesizeAndUpload(
  text: string,
  voiceId: string | null,
): Promise<string | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("voice-call: ELEVENLABS_API_KEY missing");
    return null;
  }
  const safeText = prepareForTts(text).slice(0, 900);
  if (!safeText) return null;

  const finalVoice = voiceId || "EXAVITQu4vr4xnSDxMaL";
  try {
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${finalVoice}?output_format=mp3_22050_32`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: safeText,
          // Flash v2.5 = ElevenLabs' lowest-latency model (~75ms TTFB).
          // Big win vs turbo_v2 for phone calls where every ms is dead air.
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
    if (!ttsRes.ok) {
      console.error(
        "voice-call: ElevenLabs TTS failed",
        ttsRes.status,
        await ttsRes.text(),
      );
      return null;
    }
    const buf = new Uint8Array(await ttsRes.arrayBuffer());
    const objectName = `${crypto.randomUUID()}.mp3`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(PUBLIC_BUCKET)
      .upload(objectName, buf, {
        contentType: "audio/mpeg",
        cacheControl: "3600",
        upsert: false,
      });
    if (upErr) {
      console.error("voice-call: upload failed", upErr);
      return null;
    }

    const { data: pub } = supabaseAdmin.storage
      .from(PUBLIC_BUCKET)
      .getPublicUrl(objectName);
    return pub.publicUrl;
  } catch (e) {
    console.error("voice-call: synthesizeAndUpload error", e);
    return null;
  }
}

export async function prepareStreamingAudioUrl(
  text: string,
  voiceId: string | null,
  baseUrl: string,
): Promise<string | null> {
  if (!process.env.ELEVENLABS_API_KEY || !process.env.LOVABLE_API_KEY) {
    console.error("voice-call: streaming audio secrets missing");
    return null;
  }

  const safeText = prepareForTts(text).slice(0, 650);
  if (!safeText) return null;

  const payload = Buffer.from(
    JSON.stringify({
      t: safeText,
      v: voiceId || "EXAVITQu4vr4xnSDxMaL",
      exp: Date.now() + 5 * 60 * 1000,
    }),
  ).toString("base64url");
  const sig = await signAudioPayload(payload);
  return `${baseUrl}/api/public/voice/stream/${payload}.${sig}`;
}

export async function streamSynthesizedAudio(token: string): Promise<Response> {
  const payload = await verifyAudioToken(token);
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!payload || !apiKey) return silentWavResponse();

  try {
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(payload.v)}/stream?output_format=mp3_22050_32&optimize_streaming_latency=4`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: payload.t,
          model_id: "eleven_flash_v2_5",
          voice_settings: {
            stability: 0.35,
            similarity_boost: 0.65,
            style: 0,
            use_speaker_boost: false,
            speed: 1.08,
          },
        }),
      },
    );

    if (!ttsRes.ok || !ttsRes.body) {
      console.error(
        "voice-call: ElevenLabs stream failed",
        ttsRes.status,
        await ttsRes.text(),
      );
      return silentWavResponse();
    }

    return new Response(ttsRes.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("voice-call: streamSynthesizedAudio error", e);
    return silentWavResponse();
  }
}

type AudioTokenPayload = { t: string; v: string; exp: number };

async function signAudioPayload(payload: string) {
  const secret = process.env.LOVABLE_API_KEY || "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return Buffer.from(signature).toString("base64url");
}

async function verifyAudioToken(token: string): Promise<AudioTokenPayload | null> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = await signAudioPayload(payload);
  if (signature !== expected) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as AudioTokenPayload;
    if (!parsed.t || !parsed.v || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function silentWavResponse() {
  const sampleRate = 8000;
  const samples = sampleRate / 4;
  const dataSize = samples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);
  return new Response(buffer, {
    status: 200,
    headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
  });
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

/**
 * Build the system prompt for the voice agent — same shape as the
 * SMS/chat prompts but tuned for being spoken aloud over the phone.
 */
export function buildVoiceSystemPrompt(agent: {
  business_name: string;
  industry: string | null;
  tone: string | null;
  primary_goal: string | null;
  services: string | null;
  faqs: string | null;
  pricing_notes: string | null;
  booking_link: string | null;
  emergency_number: string | null;
  escalation_triggers: string | null;
  assistant_name: string | null;
}) {
  const name = agent.assistant_name || "Ava";
  return `You are ${name}, a warm and professional AI receptionist for ${agent.business_name}${agent.industry ? ` (${agent.industry})` : ""}.

You are speaking with the caller live over the phone. Your reply will be spoken out loud, so:
- Use natural spoken language (no markdown, no bullet points, no URLs read out).
- Aim for 1 short sentence. Only use 2 short sentences if truly necessary.
- If you must read a phone number, say each digit separately.
- Pause naturally with commas. Avoid long lists.

Tone: ${agent.tone || "warm, friendly, professional"}.
Primary goal: ${agent.primary_goal || "Help the caller and capture their contact info if appropriate."}

Services:
${agent.services || "(none provided)"}

FAQs:
${agent.faqs || "(none provided)"}

Pricing notes:
${agent.pricing_notes || "(none provided)"}

Booking link (do NOT read the URL aloud — offer to text it instead): ${agent.booking_link || "(none)"}
Emergency / handoff number: ${agent.emergency_number || "(none)"}
Escalate to a human if: ${agent.escalation_triggers || "(use judgment)"}

Rules:
- Be extremely concise.
- If the caller asks to book, offer to text them the booking link.
- If you don't know an answer, offer to take a message or transfer them.
- If they ask for a human or it's an emergency, say you'll transfer them now.`;
}

/**
 * Build a TwiML response for one turn of the call:
 *  - <Play> the agent's spoken reply (or <Say> if TTS failed)
 *  - <Gather input="speech"> the caller's next utterance and post it
 *    back to the turn endpoint with the conversation id.
 *
 * If `audioUrl` is null, falls back to Twilio's built-in TTS so the
 * call still proceeds even if ElevenLabs is unavailable.
 */
export function gatherTwiml(opts: {
  audioUrl: string | null;
  fallbackText: string;
  conversationId: string;
  callerNumber: string;
  destinationNumber: string;
  baseUrl: string;
  hangup?: boolean;
  transferTo?: string | null;
}) {
  const speak = opts.audioUrl
    ? `<Play>${escapeXml(opts.audioUrl)}</Play>`
    : `<Say voice="Polly.Joanna">${escapeXml(opts.fallbackText)}</Say>`;

  if (opts.hangup) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response>${speak}<Hangup/></Response>`;
    return xmlResponse(xml);
  }

  if (opts.transferTo) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response>${speak}<Dial>${escapeXml(opts.transferTo)}</Dial></Response>`;
    return xmlResponse(xml);
  }

  const turnUrl = `${opts.baseUrl}/api/public/twilio/voice/turn`;
  const params = new URLSearchParams({
    cid: opts.conversationId,
    from: opts.callerNumber,
    to: opts.destinationNumber,
  });
  const actionUrl = `${turnUrl}?${params.toString()}`;

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response>` +
    // speechTimeout="1" → end-of-speech detection fires after just 1s of
    // silence (vs "auto" which can wait 2-3s). timeout="6" caps how long
    // we wait for the caller to start speaking. actionOnEmptyResult makes
    // sure we still post back even on silence so the call continues.
    `<Gather input="speech" action="${escapeXml(actionUrl)}" method="POST" speechTimeout="1" timeout="6" actionOnEmptyResult="true" speechModel="phone_call" language="en-US">` +
    speak +
    `</Gather>` +
    // If <Gather> times out without speech, prompt once more then hang up.
    `<Say voice="Polly.Joanna">Sorry, I didn't catch that. Please call back any time.</Say>` +
    `<Hangup/>` +
    `</Response>`;
  return xmlResponse(xml);
}

export function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function xmlResponse(xml: string) {
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

/**
 * Detects whether the agent's most recent reply implies a handoff to
 * a human is appropriate — used to <Dial> the emergency number.
 */
export function shouldTransfer(reply: string) {
  const lower = reply.toLowerCase();
  return (
    /transfer(ring)? you/.test(lower) ||
    /connect(ing)? you (to|with) (a|our) (human|team|agent|specialist|owner)/.test(
      lower,
    ) ||
    /one moment while i transfer/.test(lower)
  );
}

/**
 * Returns the public origin Twilio is reaching us at, e.g.
 * https://project--<id>.lovable.app — needed because Twilio must POST
 * back to a fully-qualified URL on every turn.
 */
export function originFromRequest(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}
