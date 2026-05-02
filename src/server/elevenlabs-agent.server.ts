// Server-only helpers for the ElevenLabs Agents Platform.
// Build the system prompt, voice, and post-call webhook config for an
// AI Receptionist, then create or update the agent in ElevenLabs.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildBookingPromptAddendum, getCalendarConfig } from "./widget-booking-tools";

const EL_BASE = "https://api.elevenlabs.io/v1";
const PROJECT_ID = "d1e796ad-671c-47e1-843b-cdecc02fe11f";

// Public base URL the ElevenLabs voice agent uses to call our booking webhooks.
// Using the stable preview URL so it works before publishing too.
function publicBaseUrl(): string {
  return `https://project--${PROJECT_ID}-dev.lovable.app`;
}

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
  // Set when the agent has Google Calendar connected — enables booking tools + prompt.
  booking_enabled?: boolean;
  booking_prompt_addendum?: string | null;
  // Workspace tool ids to attach to the agent (find_slots + book_appointment).
  tool_ids?: string[];
}

export function buildSystemPrompt(p: AgentBusinessProfile): string {
  const name = (p.assistant_name || "the receptionist").trim();
  const biz = p.business_name.trim();
  const tone = (p.tone || "warm and professional").trim();
  const goal = (p.primary_goal || "help the caller and capture their contact info").trim();

  const lines: string[] = [];
  lines.push(`You are ${name}, the AI receptionist for ${biz}.`);
  lines.push(`# Identity (STRICT)`);
  lines.push(`- Your name is "${name}". Never introduce yourself as anything else.`);
  lines.push(`- Do NOT use any other name under any circumstance, even if a caller asks.`);
  lines.push(`- If asked your name, answer exactly: "${name}".`);
  lines.push(``);
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
  lines.push(``);
  lines.push(`# Voicemail handling (CRITICAL for outbound calls)`);
  lines.push(`On outbound callbacks (when {{call_direction}} is "outbound"), you said a brief "Hello?" and are now LISTENING. The next thing you hear will be either a live human or a voicemail/answering machine.`);
  lines.push(``);
  lines.push(`You MUST call the \`voicemail_detection\` tool IMMEDIATELY (do not respond verbally first) the moment you hear ANY of these signals:`);
  lines.push(`- A recorded greeting that mentions "leave a message", "after the tone", "after the beep", "not available", "can't come to the phone", "you've reached the voicemail of", "please record your message".`);
  lines.push(`- The phrase "please leave your name and number".`);
  lines.push(`- A beep or tone.`);
  lines.push(`- A long monologue (more than ~5 seconds) with no pause for you to respond.`);
  lines.push(`- Silence for more than 4 seconds after your "Hello?".`);
  lines.push(`- Any automated-sounding greeting that doesn't address you back.`);
  lines.push(``);
  lines.push(`Calling the tool will automatically leave the configured voicemail message and hang up — you do NOT need to speak the voicemail message yourself. Do not try to have a conversation with a voicemail. When in doubt, call the tool — false positives are fine.`);
  lines.push(``);
  lines.push(`If instead you hear a clearly live human (they say "hello", "yes", "this is [name]", or ask who's calling), THEN respond naturally: "Hi {{lead_name}}, this is ${name} from ${biz} — I'm following up on your earlier inquiry, is now a good time?"`);

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

  // Booking instructions: prefer the live Google Calendar tool flow when
  // available, otherwise fall back to the static booking link / message-taking.
  if (p.booking_enabled && p.booking_prompt_addendum) {
    lines.push(``);
    lines.push(`# Booking (LIVE — you can book on the calendar)`);
    lines.push(p.booking_prompt_addendum);
    lines.push(``);
    lines.push(`PHONE-CALL BOOKING NOTES`);
    lines.push(`- You are on a phone call, so the caller cannot read text. Read times in plain English ("Tuesday at 2:30 PM"), never read out the ISO timestamp.`);
    lines.push(`- Email is OPTIONAL on phone bookings — many callers can't easily spell it out loud. Always collect their full name AND a callback phone number before calling book_appointment. Only ask for email if they offer it.`);
    lines.push(`- Use the caller's phone number (the one they're calling from, or one they give you) as customer_phone.`);
    lines.push(`- After a successful booking, repeat the date and time back to confirm, then move on.`);
  } else if (p.booking_link) {
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

  // Caller context (filled in via dynamic variables when known — e.g. on
  // outbound callbacks to a saved lead, or via the Twilio personalization
  // webhook for inbound calls). When the variables are empty, treat the
  // caller as new.
  lines.push(``);
  lines.push(`# Caller context (may be empty)`);
  lines.push(`- Call direction: {{call_direction}}  (inbound = they called you; outbound = you are calling them back)`);
  lines.push(`- Caller name (if known): {{lead_name}}`);
  lines.push(`- Previous notes about this caller (if any): {{lead_notes}}`);
  lines.push(`If "Caller name" is set, this person is a returning lead — greet them by their first name and naturally reference what you already know if it helps. If empty, treat them as a brand new caller and ask their name as usual.`);
  lines.push(`If call direction is "outbound", you are calling THEM — do NOT say "thanks for calling". Instead say something like "Hi {{lead_name}}, this is ${name} from ${biz} — I'm following up on your earlier inquiry, is now a good time?". Be ready for voicemail (see Voicemail handling above).`);

  return lines.join("\n");
}

function buildFirstMessage(p: AgentBusinessProfile): string {
  const name = (p.assistant_name || "the receptionist").trim();
  const biz = p.business_name.trim();
  // Keep the first sentence safe for both inbound calls and outbound callbacks.
  // Direction-specific wording is handled by the system prompt after context is available.
  return `Hi, this is ${name} from ${biz}.`;
}

interface ElevenLabsAgentConfig {
  conversation_config: {
    agent: {
      first_message: string;
      language: string;
      prompt: {
        prompt: string;
        llm: string;
        tool_ids?: string[];
        built_in_tools?: {
          voicemail_detection?: {
            type: "system";
            name: "voicemail_detection";
            description?: string;
            params: {
              system_tool_type: "voicemail_detection";
              voicemail_message?: string;
            };
          } | null;
        };
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
          // Bumped from gemini-2.0-flash — ElevenLabs explicitly recommends
          // 2.5-flash (or stronger) when the agent has webhook tools because
          // 2.0-flash is unreliable at extracting tool parameters.
          llm: "gemini-2.5-flash",
          tool_ids: p.tool_ids && p.tool_ids.length > 0 ? p.tool_ids : undefined,
          // Voicemail detection is a built-in system tool (not a workspace tool).
          // EL rejects mixing the legacy `tools[]` array with `tool_ids`, so we
          // use the `built_in_tools` map exclusively.
          built_in_tools: {
            voicemail_detection: {
              type: "system",
              name: "voicemail_detection",
              description:
                "Use when an outbound callback reaches voicemail, an answering machine, a recorded greeting, a beep, or silence instead of a live person. Leave the configured voicemail message, then end the call.",
              params: {
                system_tool_type: "voicemail_detection",
                voicemail_message: `Hi {{lead_name}}, this is ${p.assistant_name || "the receptionist"} from ${p.business_name}. I'm calling to follow up on your earlier inquiry. Please call us back when you have a chance. Thank you, goodbye.`,
              },
            },
          },
        },
      },
      tts: {
        voice_id: p.voice_id || "EXAVITQu4vr4xnSDxMaL",
        // English phone agents require an English v2 realtime model; Flash v2 is the default for agents.
        model_id: "eleven_flash_v2",
        stability: 0.6,
        similarity_boost: 0.8,
        speed: 1.0,
      },
      asr: {
        quality: "high",
        provider: "elevenlabs",
        // Twilio phone calls arrive as μ-law 8kHz audio.
        user_input_audio_format: "ulaw_8000",
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

// ----- Booking webhook tool sync (find_slots + book_appointment) -----

interface ToolSyncResult {
  toolIds: string[];
  bookingPromptAddendum: string | null;
  findSlotsToolId: string | null;
  bookToolId: string | null;
}

function buildFindSlotsToolConfig(agentDbId: string) {
  return {
    type: "webhook" as const,
    name: "find_available_slots",
    description:
      "Look up open appointment slots on a specific date. Call this BEFORE offering times to the caller. Returns voice-friendly slot strings (e.g. 'Tue, Mar 5 2:30 PM') and the matching ISO timestamp you must pass to book_appointment.",
    response_timeout_secs: 15,
    api_schema: {
      url: `${publicBaseUrl()}/api/public/voice-tools/find-slots`,
      method: "POST",
      request_body_schema: {
        type: "object",
        required: ["agent_id", "date"],
        description: "Find available appointment slots for a date",
        properties: {
          agent_id: { type: "string", constant_value: agentDbId },
          date: { type: "string", description: "Date in YYYY-MM-DD format (e.g. 2026-03-05)." },
          duration_minutes: { type: "number", description: "Optional appointment length in minutes." },
        },
      },
    },
  };
}

function buildBookToolConfig(agentDbId: string) {
  return {
    type: "webhook" as const,
    name: "book_appointment",
    description:
      "Book a confirmed appointment on the calendar. ONLY call after the caller has chosen a specific slot returned by find_available_slots AND you have collected their name and a callback phone number. Repeat the date/time back in plain English after success.",
    response_timeout_secs: 20,
    api_schema: {
      url: `${publicBaseUrl()}/api/public/voice-tools/book-appointment`,
      method: "POST",
      request_body_schema: {
        type: "object",
        required: ["agent_id", "start_iso", "customer_name", "customer_phone"],
        description: "Book a confirmed appointment",
        properties: {
          agent_id: { type: "string", constant_value: agentDbId },
          start_iso: { type: "string", description: "ISO 8601 start timestamp from find_available_slots (must match exactly)." },
          duration_minutes: { type: "number", description: "Optional appointment length in minutes." },
          customer_name: { type: "string", description: "Caller's full name." },
          customer_phone: { type: "string", description: "Caller's phone number (the number they're calling from is fine)." },
          customer_email: { type: "string", description: "Optional email — only ask if the caller offers it." },
          reason: { type: "string", description: "Optional short reason for the appointment." },
        },
      },
    },
  };
}

async function createWorkspaceTool(toolConfig: unknown): Promise<string> {
  const apiKey = requireKey();
  const res = await fetch(`${EL_BASE}/convai/tools`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ tool_config: toolConfig }),
  });
  if (!res.ok) throw new Error(`EL create tool failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("EL returned no tool id");
  return json.id;
}

async function updateWorkspaceTool(toolId: string, toolConfig: unknown): Promise<void> {
  const apiKey = requireKey();
  const res = await fetch(`${EL_BASE}/convai/tools/${toolId}`, {
    method: "PATCH",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ tool_config: toolConfig }),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`EL update tool failed (${res.status}): ${await res.text()}`);
  }
}

async function deleteWorkspaceTool(toolId: string): Promise<void> {
  const apiKey = requireKey();
  const res = await fetch(`${EL_BASE}/convai/tools/${toolId}`, {
    method: "DELETE",
    headers: { "xi-api-key": apiKey },
  });
  if (!res.ok && res.status !== 404) {
    console.error(`EL delete tool ${toolId} failed (${res.status}): ${await res.text()}`);
  }
}

/**
 * Sync the booking webhook tools for an agent based on whether Google Calendar
 * is connected. Creates / updates / deletes tools as needed and persists the
 * resulting tool ids on the agents row.
 */
export async function syncBookingToolsForAgent(agentDbId: string): Promise<ToolSyncResult> {
  const { data: row } = await supabaseAdmin
    .from("agents")
    .select("elevenlabs_find_slots_tool_id, elevenlabs_book_tool_id")
    .eq("id", agentDbId)
    .maybeSingle();

  const existingFindId = row?.elevenlabs_find_slots_tool_id ?? null;
  const existingBookId = row?.elevenlabs_book_tool_id ?? null;

  const cfg = await getCalendarConfig(agentDbId);

  if (!cfg) {
    // Calendar not connected — tear down any existing tools.
    if (existingFindId) await deleteWorkspaceTool(existingFindId);
    if (existingBookId) await deleteWorkspaceTool(existingBookId);
    if (existingFindId || existingBookId) {
      await supabaseAdmin
        .from("agents")
        .update({ elevenlabs_find_slots_tool_id: null, elevenlabs_book_tool_id: null })
        .eq("id", agentDbId);
    }
    return { toolIds: [], bookingPromptAddendum: null, findSlotsToolId: null, bookToolId: null };
  }

  const findCfg = buildFindSlotsToolConfig(agentDbId);
  const bookCfg = buildBookToolConfig(agentDbId);

  let findId = existingFindId;
  let bookId = existingBookId;

  if (findId) {
    await updateWorkspaceTool(findId, findCfg);
  } else {
    findId = await createWorkspaceTool(findCfg);
  }
  if (bookId) {
    await updateWorkspaceTool(bookId, bookCfg);
  } else {
    bookId = await createWorkspaceTool(bookCfg);
  }

  if (findId !== existingFindId || bookId !== existingBookId) {
    await supabaseAdmin
      .from("agents")
      .update({ elevenlabs_find_slots_tool_id: findId, elevenlabs_book_tool_id: bookId })
      .eq("id", agentDbId);
  }

  return {
    toolIds: [findId!, bookId!],
    bookingPromptAddendum: buildBookingPromptAddendum(cfg),
    findSlotsToolId: findId,
    bookToolId: bookId,
  };
}

/**
 * Delete the booking webhook tools for an agent (used when removing the
 * receptionist entirely so we don't leak workspace tools in EL).
 */
export async function deleteBookingToolsForAgent(agentDbId: string): Promise<void> {
  const { data: row } = await supabaseAdmin
    .from("agents")
    .select("elevenlabs_find_slots_tool_id, elevenlabs_book_tool_id")
    .eq("id", agentDbId)
    .maybeSingle();
  if (!row) return;
  if (row.elevenlabs_find_slots_tool_id) {
    await deleteWorkspaceTool(row.elevenlabs_find_slots_tool_id).catch(() => {});
  }
  if (row.elevenlabs_book_tool_id) {
    await deleteWorkspaceTool(row.elevenlabs_book_tool_id).catch(() => {});
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

/** Get a signed WebSocket URL for the browser preview (more reliable than WebRTC in iframes). */
export async function getConversationSignedUrl(agentId: string): Promise<string> {
  const apiKey = requireKey();
  const res = await fetch(
    `${EL_BASE}/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    { headers: { "xi-api-key": apiKey } },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`ElevenLabs signed URL failed (${res.status}): ${t}`);
  }
  const json = (await res.json()) as { signed_url?: string };
  if (!json.signed_url) throw new Error("ElevenLabs returned no signed_url");
  return json.signed_url;
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

/** Remove a phone number from the ElevenLabs workspace. */
export async function deleteElevenLabsPhoneNumber(phoneNumberId: string): Promise<void> {
  const apiKey = requireKey();
  const res = await fetch(`${EL_BASE}/convai/phone-numbers/${phoneNumberId}`, {
    method: "DELETE",
    headers: { "xi-api-key": apiKey },
  });
  // 404 = already gone, fine.
  if (!res.ok && res.status !== 404) {
    const t = await res.text();
    throw new Error(`ElevenLabs delete phone number failed (${res.status}): ${t}`);
  }
}

export function postCallWebhookUrl(): string {
  return `https://project--${PROJECT_ID}-dev.lovable.app/api/public/elevenlabs/postcall`;
}

/** Register a Twilio voice webhook call with ElevenLabs and return TwiML. */
export async function registerTwilioCall(opts: {
  agentId: string;
  fromNumber: string;
  toNumber: string;
  direction: "inbound" | "outbound";
  dynamicVariables?: Record<string, string>;
  firstMessage?: string;
}): Promise<string> {
  const apiKey = requireKey();
  const body: Record<string, unknown> = {
    agent_id: opts.agentId,
    from_number: opts.fromNumber,
    to_number: opts.toNumber,
    direction: opts.direction,
  };
  if ((opts.dynamicVariables && Object.keys(opts.dynamicVariables).length > 0) || opts.firstMessage) {
    body.conversation_initiation_client_data = {
      ...(opts.firstMessage
        ? { conversation_config_override: { agent: { first_message: opts.firstMessage } } }
        : {}),
      ...(opts.dynamicVariables && Object.keys(opts.dynamicVariables).length > 0
        ? { dynamic_variables: opts.dynamicVariables }
        : {}),
    };
  }

  const res = await fetch(`${EL_BASE}/convai/twilio/register-call`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`ElevenLabs register call failed (${res.status}): ${text}`);
  }
  return text;
}

/**
 * Place an outbound call via Twilio + ElevenLabs.
 * `agentPhoneNumberId` must be the ElevenLabs phone-number id returned by
 * `importTwilioNumber` (we store it on `phone_numbers.elevenlabs_phone_number_id`).
 * `dynamicVariables` is injected into the agent prompt / first message
 * (e.g. `{ lead_name: "Jordan", lead_notes: "asked about pricing" }`).
 */
export async function placeOutboundCall(opts: {
  agentId: string;
  agentPhoneNumberId: string;
  toNumber: string;
  dynamicVariables?: Record<string, string>;
  firstMessage?: string;
}): Promise<{ conversation_id: string | null; call_sid: string | null }> {
  const apiKey = requireKey();
  const body: Record<string, unknown> = {
    agent_id: opts.agentId,
    agent_phone_number_id: opts.agentPhoneNumberId,
    to_number: opts.toNumber,
  };
  if ((opts.dynamicVariables && Object.keys(opts.dynamicVariables).length > 0) || opts.firstMessage) {
    body.conversation_initiation_client_data = {
      ...(opts.firstMessage
        ? { conversation_config_override: { agent: { first_message: opts.firstMessage } } }
        : {}),
      ...(opts.dynamicVariables && Object.keys(opts.dynamicVariables).length > 0
        ? { dynamic_variables: opts.dynamicVariables }
        : {}),
    };
  }

  const res = await fetch(`${EL_BASE}/convai/twilio/outbound-call`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`ElevenLabs outbound call failed (${res.status}): ${t}`);
  }
  const json = (await res.json()) as {
    success?: boolean;
    message?: string;
    conversation_id?: string | null;
    callSid?: string | null;
  };
  if (json.success === false) {
    throw new Error(`ElevenLabs outbound call rejected: ${json.message ?? "unknown reason"}`);
  }
  return {
    conversation_id: json.conversation_id ?? null,
    call_sid: json.callSid ?? null,
  };
}
