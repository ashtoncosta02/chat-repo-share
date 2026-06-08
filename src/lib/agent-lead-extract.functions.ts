import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ExtractInput = z.object({
  // Recent conversation context (last few turns) so the model can see
  // a name mentioned earlier and a phone mentioned later in the same chat.
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .min(1)
    .max(20),
});

const ExtractedSchema = z.object({
  name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type ExtractedLead = z.infer<typeof ExtractedSchema>;

/**
 * Best-effort lead extraction from the recent conversation.
 * Returns nullable fields — only fields the user actually shared.
 * Returns { success: true, lead: null } when no contact info is present.
 */
export const extractLeadFromChat = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { success: false as const, error: "AI service is not configured." };
    }

    const transcript = data.messages
      .map((m) => `${m.role === "user" ? "Caller" : "Agent"}: ${m.content}`)
      .join("\n");

    const system = `You extract lead/contact information from a chat transcript between a caller and an AI receptionist.

Return ONLY a JSON object with these keys (all optional, use null if not present):
{
  "name": string | null,        // caller's name if they shared it
  "phone": string | null,       // phone number in any format the caller gave
  "email": string | null,       // email if mentioned
  "notes": string | null        // 1 short sentence summarizing what they want (booking, question, complaint, etc.)
}

Rules:
- Only extract info the CALLER provided. Never invent.
- If the caller said nothing identifying, return all nulls.
- Output valid JSON only. No prose, no markdown fences.`;

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
          response_format: { type: "json_object" },
        }),
      });

      if (!aiRes.ok) {
        if (aiRes.status === 429)
          return { success: false as const, error: "Rate limited extracting lead." };
        if (aiRes.status === 402)
          return { success: false as const, error: "AI credits exhausted." };
        const t = await aiRes.text();
        console.error("lead-extract gateway error:", aiRes.status, t);
        return { success: false as const, error: "Lead extraction failed." };
      }

      const json = await aiRes.json();
      const raw = json.choices?.[0]?.message?.content as string | undefined;
      if (!raw) return { success: true as const, lead: null };

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Strip code fences if the model wrapped it
        const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          return { success: true as const, lead: null };
        }
      }

      const result = ExtractedSchema.safeParse(parsed);
      if (!result.success) return { success: true as const, lead: null };

      const lead = result.data;
      const hasAny =
        (lead.name && lead.name.trim()) ||
        (lead.phone && lead.phone.trim()) ||
        (lead.email && lead.email.trim());

      if (!hasAny) return { success: true as const, lead: null };
      return { success: true as const, lead };
    } catch (e) {
      console.error("extractLeadFromChat error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Unexpected lead extraction error.",
      };
    }
  });
