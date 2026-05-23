import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ conversationId: z.string().uuid() });

export const summarizeConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { success: false as const, error: "AI not configured." };

    // Pull messages (RLS-scoped to the user)
    const { data: msgs, error: msgErr } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (msgErr) return { success: false as const, error: msgErr.message };
    if (!msgs || msgs.length === 0)
      return { success: false as const, error: "No messages to summarize." };

    const transcript = msgs
      .map((m) => `${m.role === "user" ? "Caller" : "Agent"}: ${m.content}`)
      .join("\n");

    const system = `You summarize a conversation between a caller and an AI receptionist into ONE short sentence (max ~140 chars). Focus on what the caller wanted (booking, question, complaint, request) and the outcome. No prose, no quotes, no "The caller…" prefix — just the summary sentence.`;

    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: system },
            { role: "user", content: transcript },
          ],
        }),
      });

      if (!aiRes.ok) {
        if (aiRes.status === 429)
          return { success: false as const, error: "Rate limited." };
        if (aiRes.status === 402)
          return { success: false as const, error: "AI credits exhausted." };
        return { success: false as const, error: `AI error ${aiRes.status}` };
      }

      const json = await aiRes.json();
      const summary = (json.choices?.[0]?.message?.content as string | undefined)?.trim();
      if (!summary) return { success: false as const, error: "Empty summary." };

      const { error: upErr } = await supabase
        .from("conversations")
        .update({ ai_summary: summary })
        .eq("id", data.conversationId);
      if (upErr) return { success: false as const, error: upErr.message };

      return { success: true as const, summary };
    } catch (e) {
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Unexpected error.",
      };
    }
  });
