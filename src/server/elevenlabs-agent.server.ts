// Server-only helpers for the ElevenLabs Agents Platform.
// Build the system prompt, voice, and post-call webhook config for an
// AI Receptionist, then create or update the agent in ElevenLabs.

const EL_BASE = "https://api.elevenlabs.io/v1";
const PROJECT_ID = "d1e796ad-671c-47e1-843b-cdecc02fe11f";

export interface AgentBusinessProfile {
  business_name: string;
  assistant_name: string | null;
  industry: string | null;
  tone: string | null;
  primary_goal: string | null;
  services: string | null;
  booking_link: string | null;
  emergency_number: string | null;
  pricing_notes: string | null;
  escalation_triggers: string | null;
  voice_id: string | null;
  faqs_structured: Array<{ question: string; answer: string }> | null;
}

export function buildSystemPrompt(p: AgentBusinessProfile): string {
  const name = (p.assistant_name || "Ava").trim();
  const biz = p.business_name.trim();
  const tone = (p.tone || "warm and professional").trim();
  const goal = (p.primary_goal || "help the caller and capture their contact info").trim();

  const lines: string[] = [];
  lines.push(`You are ${name}, the AI receptionist for ${biz}.`);
  lines.push(`Your tone is ${tone}. Speak naturally, like a real person on the phone — short sentences, contractions, no robotic phrasing.`);
  lines.push(`Your primary goal: ${goal}.`);
  lines.push(``);
  lines.push(`# Conversation rules`);
  lines.push(`- Greet the caller, then listen. Don't monologue.`);
  lines.push(`- One question at a time.`);
  lines.push(`- If you don't know something, say so honestly and offer to take a message.`);
  lines.push(`- Never invent prices, hours, or policies that aren't in your knowledge.`);
  lines.push(`- Always confirm the caller's name and callback number before ending the call.`);
  lines.push(`- End calls warmly: thank them by name and say goodbye.`);

  if (p.industry) {
    lines.push(``);
    lines.push(`# Industry`);
    lines.push(p.industry.trim());
  }

  if (p.services) {
    lines.push(``);
    lines.push(`# Services offered`);
    lines.push(p.services.trim());
  }

  if (p.pricing_notes) {
    lines.push(``);
    lines.push(`# Pricing notes`);
    lines.push(p.pricing_notes.trim());
  }

  if (p.booking_link) {
    lines.push(``);
    lines.push(`# Booking`);
    lines.push(`To book an appointment, direct callers to: ${p.booking_link.trim()}`);
    lines.push(`If they want you to book for them, take their preferred date/time and contact info, and tell them someone will confirm shortly.`);
  }

  if (p.emergency_number) {
    lines.push(``);
    lines.push(`# Emergencies`);
    lines.push(`If the call is urgent, give them this number immediately: ${p.emergency_number.trim()}`);
  }

  if (p.escalation_triggers) {
    lines.push(``);
    lines.push(`# When to escalate to a human`);
    lines.push(p.escalation_triggers.trim());
    lines.push(`When escalating, take the caller's name, number, and a short message, then say a team member will call back.`);
  }

  if (p.faqs_structured && p.faqs_structured.length > 0) {
    lines.push(``);
    lines.push(`# Frequently asked questions`);
    for (const faq of p.faqs_structured) {
      const q = (faq.question || "").trim();
      const a = (faq.answer || "").trim();
      if (q && a) {
        lines.push(`Q: ${q}`);
        lines.push(`A: ${a}`);
        lines.push(``);
      }
    }
  }

  return lines.join("\n");
}

function buildFirstMessage(p: AgentBusinessProfile): string {
  const name = (p.assistant_name || "Ava").trim();
  const biz = p.business_name.trim();
  return `Hi, thanks for calling ${biz}. This is ${name} — how can I help you today?`;
}

interface ElevenLabsAgentConfig {
  conversation_config: {
    agent: {
      first_message: string;
      language: string;
      prompt: {
        prompt: string;
        llm: string;
      };
    };
    tts: {
      voice_id: string;
      model_id: string;
      stability: number;
      similarity_boost: number;
      speed: number;
    };
    asr: {
      quality: string;
      provider: string;
      user_input_audio_format: string;
    };
    turn: {
      turn_timeout: number;
      mode: string;
    };
  };
  platform_settings?: {
    workspace_overrides?: {
      webhooks?: {
        post_call_webhook_id?: string | null;
      };
    };
  };
  name: string;
}

function buildAgentPayload(p: AgentBusinessProfile): ElevenLabsAgentConfig {
  return {
    name: `${p.business_name} — AI Receptionist`,
    conversation_config: {
      agent: {
        first_message: buildFirstMessage(p),
        language: "en",
        prompt: {
          prompt: buildSystemPrompt(p),
          // Fast + cheap reasoning model for natural phone conversation.
          llm: "gemini-2.0-flash",
        },
      },
      tts: {
        voice_id: p.voice_id || "EXAVITQu4vr4xnSDxMaL",
        // English agents require turbo or flash v2 family. Flash v2 is fastest.
        model_id: "eleven_flash_v2",
        stability: 0.5,
        similarity_boost: 0.75,
        speed: 1.0,
      },
      asr: {
        quality: "high",
        provider: "elevenlabs",
        user_input_audio_format: "pcm_16000",
      },
      turn: {
        // Stop responding when caller starts talking; resume after 700ms silence.
        turn_timeout: 7,
        mode: "turn",
      },
    },
  };
}

function requireKey(): string {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ELEVENLABS_API_KEY is not configured");
  return k;
}

export async function createElevenLabsAgent(
  profile: AgentBusinessProfile,
): Promise<{ agent_id: string }> {
  const apiKey = requireKey();
  const payload = buildAgentPayload(profile);

  const res = await fetch(`${EL_BASE}/convai/agents/create`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`ElevenLabs create agent failed (${res.status}): ${t}`);
  }
  const json = (await res.json()) as { agent_id?: string };
  if (!json.agent_id) throw new Error("ElevenLabs returned no agent_id");
  return { agent_id: json.agent_id };
}

export async function updateElevenLabsAgent(
  agentId: string,
  profile: AgentBusinessProfile,
): Promise<void> {
  const apiKey = requireKey();
  const payload = buildAgentPayload(profile);

  const res = await fetch(`${EL_BASE}/convai/agents/${agentId}`, {
    method: "PATCH",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`ElevenLabs update agent failed (${res.status}): ${t}`);
  }
}

export async function deleteElevenLabsAgent(agentId: string): Promise<void> {
  const apiKey = requireKey();
  const res = await fetch(`${EL_BASE}/convai/agents/${agentId}`, {
    method: "DELETE",
    headers: { "xi-api-key": apiKey },
  });
  // 404 = already gone, fine.
  if (!res.ok && res.status !== 404) {
    const t = await res.text();
    throw new Error(`ElevenLabs delete agent failed (${res.status}): ${t}`);
  }
}

/** Get a short-lived WebRTC token for the browser preview. */
export async function getConversationToken(agentId: string): Promise<string> {
  const apiKey = requireKey();
  const res = await fetch(
    `${EL_BASE}/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
    { headers: { "xi-api-key": apiKey } },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`ElevenLabs token failed (${res.status}): ${t}`);
  }
  const json = (await res.json()) as { token?: string };
  if (!json.token) throw new Error("ElevenLabs returned no token");
  return json.token;
}

/** Import a Twilio number into ElevenLabs and link to an agent. */
export async function importTwilioNumber(opts: {
  phoneNumber: string;
  label: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  agentId: string;
}): Promise<{ phone_number_id: string }> {
  const apiKey = requireKey();
  const res = await fetch(`${EL_BASE}/convai/phone-numbers`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: "twilio",
      phone_number: opts.phoneNumber,
      label: opts.label,
      sid: opts.twilioAccountSid,
      token: opts.twilioAuthToken,
      agent_id: opts.agentId,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`ElevenLabs phone import failed (${res.status}): ${t}`);
  }
  const json = (await res.json()) as { phone_number_id?: string };
  if (!json.phone_number_id) throw new Error("ElevenLabs returned no phone_number_id");
  return { phone_number_id: json.phone_number_id };
}

export function postCallWebhookUrl(): string {
  return `https://project--${PROJECT_ID}-dev.lovable.app/api/public/elevenlabs/postcall`;
}
