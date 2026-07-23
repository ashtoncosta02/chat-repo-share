import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { coerceScenarios } from "@/lib/scenarios";
import { sendSms } from "@/server/sms.server";

interface Params {
  agentId: string;
  userId: string;
  callerNumber: string | null;
  turns: { role: "user" | "assistant"; content: string }[];
}

/**
 * After a phone call ends, look at the agent's scenarios. For each scenario
 * with a `post_call_sms` action whose intent was triggered during the call,
 * text the configured message to the caller's phone number.
 */
export async function sendScenarioPostCallSms(p: Params): Promise<void> {
  if (!p.callerNumber || p.turns.length === 0) return;

  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("scenarios")
    .eq("id", p.agentId)
    .maybeSingle();
  if (!agent) return;

  const scenarios = coerceScenarios(agent.scenarios).filter(
    (s) => s.action?.type === "post_call_sms" && s.intent.trim(),
  );
  if (scenarios.length === 0) return;

  // Ask the AI which intents were actually triggered in this call.
  const matched = await matchIntents(
    scenarios.map((s) => s.intent.trim()),
    p.turns,
  );
  if (matched.length === 0) return;

  const { data: phoneRow } = await supabaseAdmin
    .from("phone_numbers")
    .select("phone_number")
    .eq("user_id", p.userId)
    .limit(1)
    .maybeSingle();
  const from = phoneRow?.phone_number;
  if (!from) {
    console.warn("scenario-sms: no Twilio number for user", p.userId);
    return;
  }

  const seen = new Set<string>();
  for (const s of scenarios) {
    if (!matched.includes(s.intent.trim())) continue;
    if (s.action?.type !== "post_call_sms") continue;
    const body = s.action.message.trim();
    if (!body || seen.has(body)) continue;
    seen.add(body);
    try {
      await sendSms({ to: p.callerNumber, from, body });
      console.log(`scenario-sms: sent post-call SMS for intent "${s.intent}"`);
    } catch (e) {
      console.error("scenario-sms: send failed", e);
    }
  }
}

async function matchIntents(
  intents: string[],
  turns: { role: string; content: string }[],
): Promise<string[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return [];

  const transcript = turns
    .slice(0, 80)
    .map((t) => `${t.role === "assistant" ? "Agent" : "Caller"}: ${t.content}`)
    .join("\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content:
            'You are given a phone-call transcript and a list of possible caller intents. Return ONLY a JSON array (no prose, no code fences) of the intent strings that the caller clearly expressed or asked about during the call. Copy each matching intent verbatim from the list. If none match, return [].',
        },
        {
          role: "user",
          content: `Intents:\n${intents.map((i) => `- ${i}`).join("\n")}\n\nTranscript:\n${transcript}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    console.warn("scenario-sms: intent match AI failed", res.status);
    return [];
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const arr = JSON.parse(cleaned);
    if (Array.isArray(arr)) {
      return arr.filter((x): x is string => typeof x === "string");
    }
  } catch {
    // fall through
  }
  return [];
}
