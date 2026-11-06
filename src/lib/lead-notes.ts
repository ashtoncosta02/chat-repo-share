// Pure helpers for lead capture (no server imports, safe to unit test).

const MAX_NOTES = 2000;

/**
 * Keep a repeat contact's history: newest note first, then "Earlier: " and the
 * old text, capped at 2000 characters. Unchanged when the new note is empty or
 * already at the start of the old notes.
 */
export function mergeLeadNotes(newNote: string | null | undefined, oldNote: string | null | undefined): string | null {
  const fresh = (newNote ?? "").trim();
  const old = (oldNote ?? "").trim();
  if (!fresh) return old || null;
  if (!old) return fresh.slice(0, MAX_NOTES);
  if (old.startsWith(fresh)) return old;
  return `${fresh}\n\nEarlier: ${old}`.slice(0, MAX_NOTES);
}

/** First 300 characters of what the caller/visitor said, for fallback notes. */
export function callerWordsSnippet(messages: { role: string; content: string }[]): string | null {
  const words = messages.filter((m) => m.role === "user").map((m) => m.content.trim()).filter(Boolean).join(" ");
  return words ? words.slice(0, 300) : null;
}

/** Looks like a phone number (7+ digits) or an email address. */
export function looksLikeContact(text: string): boolean {
  if (/[^\s@]+@[^\s@]+\.[^\s@]{2,}/.test(text)) return true;
  const runs = text.match(/[+(]?\d[\d\s().-]{5,}\d/g) ?? [];
  return runs.some((r) => r.replace(/\D/g, "").length >= 7);
}
