import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Input = z.object({
  accessToken: z.string().min(1),
  conversationId: z.string().uuid(),
});

export const summarizeConversation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { success: false as const, error: "AI not configured." };

    // Verify user
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(
      data.accessToken,
    );
    if (userErr || !userData?.user?.id) {
      return { success: false as const, error: "Not authenticated." };
    }
    const userId = userData.user.id;

    // Ensure conversation belongs to this user
    const { data: conv, error: convErr } = await supabaseAdmin
      .from("conversations")
      .select("id, user_id")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (convErr || !conv || conv.user_id !== userId) {
      return { success: false as const, error: "Not found." };
    }

    const { data: msgs, error: msgErr } = await supabaseAdmin
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

    const system =
      "You summarize a conversation between a caller and an AI receptionist into ONE short sentence (max ~140 chars). Focus on what the caller wanted (booking, question, complaint) and the outcome. No quotes, no 'The caller…' prefix — just the summary sentence.";

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
        return { success: false as const, error: `AI error ${aiRes.status}` };
      }

      const json = await aiRes.json();
      const summary = (json.choices?.[0]?.message?.content as string | undefined)?.trim();
      if (!summary) return { success: false as const, error: "Empty summary." };

      await supabaseAdmin
        .from("conversations")
        .update({ ai_summary: summary })
        .eq("id", data.conversationId);

      return { success: true as const, summary };
    } catch (e) {
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Unexpected error.",
      };
    }
  });
