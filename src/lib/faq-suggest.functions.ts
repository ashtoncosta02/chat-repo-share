import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { coerceFaqs } from "@/lib/faqs";

const Input = z.object({ agentId: z.string().uuid() });

export interface SuggestedFaq {
  question: string;
  answer: string;
  source: "business" | "calls";
}

export const suggestFaqs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { success: false as const, error: "AI service not configured." };

    const { supabase } = context;

    const { data: agent, error: aErr } = await supabase
      .from("agents")
      .select(
        "id, business_name, industry, services, pricing_notes, booking_link, emergency_number, primary_goal, faqs_structured, website_summary",
      )
      .eq("id", data.agentId)
      .maybeSingle();
    if (aErr || !agent) return { success: false as const, error: "Receptionist not found." };

    const existing = coerceFaqs(agent.faqs_structured);
    const existingList = existing
      .map((f) => `- ${f.question.trim()}`)
      .filter(Boolean)
      .join("\n") || "(none)";

    // Pull recent call summaries + a few caller messages to surface real questions.
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, ai_summary, started_at")
      .eq("agent_id", data.agentId)
      .not("ai_summary", "is", null)
      .order("started_at", { ascending: false })
      .limit(25);

    const convIds = (convs ?? []).map((c) => c.id);
    let callerLines: string[] = [];
    if (convIds.length > 0) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("content, role, conversation_id")
        .in("conversation_id", convIds)
        .eq("role", "user")
        .limit(200);
      callerLines = (msgs ?? [])
        .map((m) => m.content?.trim())
        .filter((c): c is string => !!c && c.length < 300);
    }

    const summaries = (convs ?? [])
      .map((c) => c.ai_summary?.trim())
      .filter((s): s is string => !!s)
      .slice(0, 15)
      .map((s, i) => `${i + 1}. ${s}`)
      .join("\n") || "(no past calls yet)";

    const callerSample = callerLines.slice(0, 40).map((l) => `- ${l}`).join("\n") || "(no caller messages yet)";

    const hasCallData = (convs?.length ?? 0) > 0;

    const businessCtx = [
      `Business: ${agent.business_name}`,
      agent.industry ? `Industry: ${agent.industry}` : null,
      (agent as { website_summary?: string | null }).website_summary
        ? `Website summary: ${(agent as { website_summary?: string | null }).website_summary}`
        : null,
      agent.primary_goal ? `Primary goal: ${agent.primary_goal}` : null,
      agent.services ? `Services:\n${agent.services}` : null,
      agent.pricing_notes ? `Pricing notes: ${agent.pricing_notes}` : null,
      agent.booking_link ? `Booking link: ${agent.booking_link}` : null,
      agent.emergency_number ? `Emergency #: ${agent.emergency_number}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const system = `You suggest useful FAQs for an AI phone receptionist.
Return ONLY JSON in this exact shape:
{"suggestions":[{"question":"...","answer":"...","source":"business"|"calls"}]}

Rules:
- 3-6 suggestions total, ordered by usefulness.
- "source":"calls" when the FAQ is inspired by real caller questions below.
- "source":"business" when derived from the business profile / website info.
- Do NOT repeat or paraphrase any of the existing FAQs.
- Answers must be short (1-3 sentences), specific to THIS business, and grounded in the info provided. If the exact answer isn't in the context, write a natural placeholder that the owner can quickly refine (e.g. "We're open Mon-Fri 9am-5pm — update with your hours.").
- No markdown, no prose outside the JSON.`;

    const userPrompt = `BUSINESS INFO:
${businessCtx}

EXISTING FAQS (do not repeat):
${existingList}

RECENT CALL SUMMARIES:
${summaries}

RECENT CALLER QUESTIONS / MESSAGES:
${callerSample}`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        if (res.status === 429)
          return { success: false as const, error: "Too many requests. Try again in a moment." };
        if (res.status === 402)
          return { success: false as const, error: "AI credits exhausted." };
        return { success: false as const, error: `AI request failed (${res.status}).` };
      }
      const j = await res.json();
      const raw = j.choices?.[0]?.message?.content as string | undefined;
      if (!raw) return { success: false as const, error: "No suggestions returned." };
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { success: false as const, error: "Bad AI response." };
      }
      const list = (parsed as { suggestions?: unknown }).suggestions;
      if (!Array.isArray(list)) return { success: true as const, suggestions: [], hasCallData };
      const suggestions: SuggestedFaq[] = list
        .map((x): SuggestedFaq | null => {
          if (!x || typeof x !== "object") return null;
          const o = x as Record<string, unknown>;
          const q = typeof o.question === "string" ? o.question.trim() : "";
          const a = typeof o.answer === "string" ? o.answer.trim() : "";
          if (!q || !a) return null;
          const src = o.source === "calls" ? "calls" : "business";
          return { question: q, answer: a, source: src };
        })
        .filter((x): x is SuggestedFaq => x !== null)
        .slice(0, 6);
      return { success: true as const, suggestions, hasCallData };
    } catch (e) {
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Unexpected error.",
      };
    }
  });
