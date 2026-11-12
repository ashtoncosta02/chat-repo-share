/**
 * Owner coaching notes are private instructions for the receptionist. The
 * website chat is public, so a visitor may try to talk the AI into repeating
 * them. This check runs on every reply before it is sent.
 *
 * Following a note is the whole point of coaching, and a reply that follows a
 * note often repeats its wording ("we offer free estimates on every job"), so
 * matching words alone must never block a reply. A reply is withheld only when
 * it looks like the notes are being disclosed:
 *  - it reproduces two or more different notes almost word for word (a list
 *    of the notes), or
 *  - it talks about its own instructions ("my instructions", "I was told
 *    to", ...) while repeating wording from a note.
 */

const WINDOW = 6;
const NEAR_FULL = 0.8;
const MIN_SHORT_NOTE_CHARS = 15;

const DISCLOSURE_PHRASES = [
  "my instructions",
  "my internal instructions",
  "internal instructions",
  "confidential instructions",
  "i was instructed",
  "i ve been instructed",
  "i have been instructed",
  "i was told to",
  "i ve been told to",
  "i have been told to",
  "coaching note",
  "coaching notes",
  "my notes say",
  "the owner told me",
  "the owner wants me to",
  "my guidelines say",
];

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Length (in words) of the longest run of consecutive note words found in the reply. */
function longestRun(replyText: string, noteWords: string[]): number {
  let best = 0;
  for (let i = 0; i < noteWords.length; i++) {
    if (noteWords.length - i <= best) break;
    let j = i;
    while (j < noteWords.length && replyText.includes(` ${noteWords.slice(i, j + 1).join(" ")} `)) j++;
    best = Math.max(best, j - i);
  }
  return best;
}

/** True when the reply appears to disclose the coaching notes rather than follow them. */
export function revealsCoaching(reply: string, notes: string[]): boolean {
  const replyText = ` ${words(reply).join(" ")} `;
  if (replyText.trim() === "") return false;
  const talksAboutInstructions = DISCLOSURE_PHRASES.some((p) => replyText.includes(` ${p} `));

  let reproduced = 0;
  for (const note of notes) {
    const w = words(note);
    if (w.length === 0) continue;
    const run = longestRun(replyText, w);
    if (w.length < WINDOW) {
      const whole = w.join(" ");
      if (whole.length < MIN_SHORT_NOTE_CHARS || run < w.length) continue;
      if (talksAboutInstructions) return true;
      reproduced++;
    } else {
      if (run < WINDOW) continue;
      if (talksAboutInstructions) return true;
      if (run >= Math.ceil(w.length * NEAR_FULL)) reproduced++;
    }
    if (reproduced >= 2) return true;
  }
  return false;
}

export const COACHING_LEAK_REPLY =
  "Sorry, I can't share that. Is there anything else I can help you with today?";
