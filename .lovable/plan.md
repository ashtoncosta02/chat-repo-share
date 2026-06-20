# Plan: Cleaner transcript emails + fix "Open conversation" link

## 1. Lead info at the top of the transcript email

`src/server/email-templates.server.ts` → `renderTranscriptEmail`:
- Add a new optional `lead` field to `TranscriptEmailInput`: `{ name, email, phone, address, notes }` (all nullable).
- Render a **"Caller details"** card at the very top (before summary + transcript) listing whichever of Name / Phone / Email / Address are present. If none are captured, fall back to today's "from <number>" line.
- Keep the existing Summary → Transcript → Open conversation order beneath it.

`src/routes/api.public.elevenlabs.postcall.ts`:
- After `captureLead(...)`, fetch the resulting lead row (`select name, email, phone, notes, address where conversation_id = convo.id`) and pass it into `renderTranscriptEmail` as `lead`.

## 2. Capture address on the lead

Today the lead extractor pulls name / phone / email / notes only. Address is never stored, so it can never appear in the email.

- Migration: `ALTER TABLE public.leads ADD COLUMN address text;` (nullable, no grants change).
- `src/lib/agent-lead-extract.functions.ts` + `src/server/lead-extraction.ts`: add `address: z.string().nullable().optional()` to the schema, instruct the LLM to capture a service/visit address when the caller volunteers one, persist it on insert/update.
- Show address on the existing dashboard lead detail / leads list cell (small follow-up — one line in `dashboard.leads.tsx`).

## 3. "Open conversation" 404

The email link is built from `NEXT_PUBLIC_SITE_URL`, which is still pointing at the old `agent-factory-omega.vercel.app` deployment (now retired) — hence the Vercel 404 in your screenshot. The custom domain `https://www.askjanice.net` is the canonical app URL.

- `src/routes/api.public.elevenlabs.postcall.ts` and `src/lib/notifications.functions.ts`: change the URL resolver to **always prefer `https://www.askjanice.net`** and only fall back to `NEXT_PUBLIC_SITE_URL` if the canonical isn't set. Add a guard that ignores any `NEXT_PUBLIC_SITE_URL` value containing `vercel.app` so the stale value can't override.
- Update the secret separately (optional cleanup): set `NEXT_PUBLIC_SITE_URL = https://www.askjanice.net` so other future code paths also pick it up. I'll do this in the same turn.

## Files touched

- `src/server/email-templates.server.ts` (template)
- `src/routes/api.public.elevenlabs.postcall.ts` (lead fetch + URL)
- `src/lib/notifications.functions.ts` (URL)
- `src/lib/agent-lead-extract.functions.ts`, `src/server/lead-extraction.ts` (address extraction)
- `src/routes/dashboard.leads.tsx` (show address)
- Migration: add `address` to `public.leads`

## One quick check before I build

If you don't want me to wire address extraction right now (it requires the AI to ask/listen for an address — only fills in when the caller actually says one), I can ship just (1) the reordered email with name/email/phone and (3) the link fix today, and add address later. Which do you prefer:

- **A**: Do everything in this plan (reorder + address column + extraction + link fix).
- **B**: Just reorder the email with name/email/phone and fix the link; skip the address column for now.
