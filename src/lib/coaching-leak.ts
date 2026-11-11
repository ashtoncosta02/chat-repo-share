/**
 * Owner coaching notes are private instructions for the receptionist. The
 * website chat is public, so a visitor may try to talk the AI into repeating
 * them. This check runs on every reply before it is sent: if the reply
 * repeats a run of words from any note, the reply is withheld.
 */

const WINDOW = 6;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** True when `reply` repeats six consecutive words (or a whole short note) from any note. */
export function revealsCoaching(reply: string, notes: string[]): boolean {
  const replyText = ` ${words(reply).join(" ")} `;
  if (replyText.trim() === "") return false;
  for (const note of notes) {
    const w = words(note);
    if (w.length === 0) continue;
    if (w.length < WINDOW) {
      const whole = w.join(" ");
      if (whole.length >= 15 && replyText.includes(` ${whole} `)) return true;
      continue;
    }
    for (let i = 0; i + WINDOW <= w.length; i++) {
      if (replyText.includes(` ${w.slice(i, i + WINDOW).join(" ")} `)) return true;
    }
  }
  return false;
}

export const COACHING_LEAK_REPLY =
  "Sorry, I can't share that. Is there anything else I can help you with today?";
