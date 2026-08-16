import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Block non-public targets so this can't be used to probe internal services. */
function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    return false;
  }
  // IPv6 loopback / link-local / unique-local
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    return false;
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 169 && b === 254) return false; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
  }
  return true;
}

const ScrapeInput = z.object({
  url: z
    .string()
    .url()
    .max(2000)
    .refine(isPublicHttpUrl, "Enter a public website address (http or https)."),
});

const ScrapeOutput = z.object({
  business_name: z.string(),
  industry: z.string(),
  tone: z.string(),
  primary_goal: z.string(),
  services: z.string(),
  booking_link: z.string(),
  emergency_number: z.string(),
  faqs: z.string(),
  pricing_notes: z.string(),
  escalation_triggers: z.string(),
});

export const scrapeBusinessFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScrapeInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { success: false as const, error: "AI service is not configured." };
    }

    try {
      // Fetch the URL content
      let pageText = "";
      try {
        const pageRes = await fetch(data.url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; AskJaniceBot/1.0)",
          },
          signal: AbortSignal.timeout(15000),
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          // Strip scripts/styles, then tags, collapse whitespace
          pageText = html
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 12000);
        }
      } catch (e) {
        console.error("Page fetch failed:", e);
      }

      if (!pageText) {
        return { success: false as const, error: "Could not load that URL. Check the link and try again." };
      }

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "You are an assistant that extracts structured business info from a website's text. Use empty strings if information is not present.",
            },
            {
              role: "user",
              content: `Extract business info from this website text. URL: ${data.url}\n\nText:\n${pageText}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_business_info",
                description: "Return structured business info to populate a voice agent config.",
                parameters: {
                  type: "object",
                  properties: {
                    business_name: { type: "string", description: "Business or brand name" },
                    industry: { type: "string", description: "e.g. Dental / Healthcare, Restaurant, Plumbing" },
                    tone: { type: "string", description: "e.g. warm, professional, friendly" },
                    primary_goal: { type: "string", description: "Main goal the agent should pursue (e.g. book appointments)" },
                    services: { type: "string", description: "Services offered, one per line" },
                    booking_link: { type: "string", description: "Booking/scheduling URL if found, else empty" },
                    emergency_number: { type: "string", description: "Emergency or main phone, else empty" },
                    faqs: { type: "string", description: "Q: ...\\nA: ...\\n\\n format if FAQs found" },
                    pricing_notes: { type: "string", description: "Pricing summary if available" },
                    escalation_triggers: { type: "string", description: "Situations to escalate to a human, one per line" },
                  },
                  required: [
                    "business_name", "industry", "tone", "primary_goal", "services",
                    "booking_link", "emergency_number", "faqs", "pricing_notes", "escalation_triggers"
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "extract_business_info" } },
        }),
      });

      if (!aiRes.ok) {
        if (aiRes.status === 429) return { success: false as const, error: "Too many requests. Try again in a minute." };
        if (aiRes.status === 402) return { success: false as const, error: "AI credits exhausted. Add credits in Workspace settings." };
        const t = await aiRes.text();
        console.error("AI gateway error:", aiRes.status, t);
        return { success: false as const, error: "AI extraction failed." };
      }

      const json = await aiRes.json();
      const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        return { success: false as const, error: "AI returned no data." };
      }

      const parsed = ScrapeOutput.parse(JSON.parse(toolCall.function.arguments));
      return { success: true as const, data: parsed };
    } catch (e) {
      console.error("scrapeBusinessFromUrl error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Unexpected error during scraping.",
      };
    }
  });
