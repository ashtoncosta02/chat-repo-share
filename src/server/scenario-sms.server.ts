import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { coerceScenarios } from "@/lib/scenarios";
import { sendSms } from "@/server/sms.server";

interface Params {
  agentId: string;
  userId: string;
  callerNumber: string | null;
  turns: { role: "user" | "assistant"; content: string }[];
  /** Optional conversation/thread id used for dedupe when the session can span
   *  multiple turns (e.g. widget chat). If provided, we skip resending a body
   *  we've already logged into `messages` for this thread. */
  dedupeThreadId?: string | null;
  /** When the call/chat happened. Anything older than an hour is never texted —
   *  recovery sweeps and late webhook retries must not text stale customers. */
  startedAt?: string | Date | null;
}

/**
 * Look at the agent's scenarios. For each scenario with a `post_call_sms`
 * action whose intent was triggered during the conversation, text the
 * configured message to the caller's phone number. Used for both finished
 * voice calls and ongoing widget chats (deduped via `dedupeThreadId`).
 */
export async function sendScenarioPostCallSms(p: Params): Promise<void> {
  if (!p.callerNumber || p.turns.length === 0) return;
  if (p.startedAt) {
    const ageMs = Date.now() - new Date(p.startedAt).getTime();
    if (Number.isFinite(ageMs) && ageMs > 60 * 60 * 1000) {
      console.log("scenario-sms: skipped — conversation is older than 1 hour");
      return;
    }
  }
  const callerTurns = p.turns.filter((t) => t.role === "user" && t.content.trim());
  if (callerTurns.length === 0) return;

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

  // Load prior outbound messages on this thread once, for dedupe.
  let alreadySent = new Set<string>();
  if (p.dedupeThreadId) {
    const { data: prior } = await supabaseAdmin
      .from("messages")
      .select("content")
      .eq("conversation_id", p.dedupeThreadId)
      .eq("role", "assistant");
    alreadySent = new Set((prior ?? []).map((r) => (r.content ?? "").trim()));
  }

  const seen = new Set<string>();
  for (const s of scenarios) {
    if (!matched.includes(s.intent.trim())) continue;
    if (s.action?.type !== "post_call_sms") continue;
    const body = s.action.message.trim();
    if (!body || seen.has(body)) continue;
    seen.add(body);
    if (alreadySent.has(body)) {
      console.log(`scenario-sms: skip already-sent SMS for intent "${s.intent}"`);
      continue;
    }
    try {
      await sendSms({ to: p.callerNumber, from, body });
      console.log(`scenario-sms: sent post-call SMS for intent "${s.intent}"`);
      if (p.dedupeThreadId) {
        await supabaseAdmin.from("messages").insert({
          user_id: p.userId,
          conversation_id: p.dedupeThreadId,
          role: "assistant",
          content: body,
        });
      }
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
            'You classify phone call transcripts against a fixed list of caller intents. Return ONLY a JSON array (no prose, no code fences) of intent strings that the CALLER explicitly and unambiguously requested or asked to do during THIS call. Copy matches verbatim from the provided list. Rules: (1) Only include an intent if the caller clearly asked for that specific thing — not if it was merely mentioned, offered by the agent, or tangentially related. (2) Do NOT include an intent just because it is the only option in the list. (3) A generic question, a hang-up, wrong number, or a call the agent could not help with = []. (4) When unsure, return []. Empty array is the correct answer for most calls.',
        },
        {
          role: "user",
          content: `Allowed intents:\n${intents.map((i) => `- ${i}`).join("\n")}\n\nTranscript:\n${transcript}\n\nReturn the JSON array now.`,
        },
      ],
      temperature: 0,
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
      const allowed = new Set(intents.map((i) => i.toLowerCase()));
      return arr
        .filter((x): x is string => typeof x === "string")
        .filter((x) => allowed.has(x.trim().toLowerCase()));
    }
  } catch {
    // fall through
  }
  return [];
}
