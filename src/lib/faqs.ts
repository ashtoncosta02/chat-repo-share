// Helpers for the structured FAQ list stored on agents.faqs_structured (jsonb).

export interface StructuredFaq {
  id: string;
  question: string;
  answer: string;
  /** Per-FAQ override: if true, AI may offer to text this answer.
   *  If undefined, falls back to agent.sms_followup_enabled. */
  sms_followup?: boolean;
}

export function newFaq(): StructuredFaq {
  return {
    id: crypto.randomUUID(),
    question: "",
    answer: "",
    sms_followup: undefined,
  };
}

/** Parse a legacy free-text FAQ blob ("Q: ...\nA: ...\n\n") into structured FAQs. */
export function parseLegacyFaqs(raw: string | null | undefined): StructuredFaq[] {
  if (!raw?.trim()) return [];
  const out: StructuredFaq[] = [];
  // Split on blank lines
  const blocks = raw.split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    let q = "";
    let a = "";
    for (const line of lines) {
      const qm = line.match(/^Q[:\.\)]\s*(.*)$/i);
      const am = line.match(/^A[:\.\)]\s*(.*)$/i);
      if (qm) q = qm[1].trim();
      else if (am) a = am[1].trim();
      else if (a) a += " " + line;
      else if (q) q += " " + line;
    }
    if (q || a) {
      out.push({ id: crypto.randomUUID(), question: q, answer: a });
    }
  }
  return out;
}

/** Coerce whatever's stored in faqs_structured (jsonb) into a clean array. */
export function coerceFaqs(raw: unknown): StructuredFaq[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): StructuredFaq | null => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const question = typeof o.question === "string" ? o.question : "";
      const answer = typeof o.answer === "string" ? o.answer : "";
      if (!question.trim() && !answer.trim()) return null;
      return {
        id: typeof o.id === "string" ? o.id : crypto.randomUUID(),
        question,
        answer,
        sms_followup: typeof o.sms_followup === "boolean" ? o.sms_followup : undefined,
      };
    })
    .filter((x): x is StructuredFaq => x !== null);
}

/** Render structured FAQs as plain text for the AI prompt. */
export function faqsToPromptText(faqs: StructuredFaq[]): string {
  if (faqs.length === 0) return "(none provided)";
  return faqs
    .filter((f) => f.question.trim() || f.answer.trim())
    .map((f) => `Q: ${f.question.trim()}\nA: ${f.answer.trim()}`)
    .join("\n\n");
}

/** Determine whether an FAQ is eligible for SMS follow-up given agent default. */
export function faqAllowsSms(faq: StructuredFaq, agentDefault: boolean): boolean {
  return faq.sms_followup ?? agentDefault;
}
