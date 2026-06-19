# Email Sending Plan (Resend via `send.askjanice.net`)

Your domain is verified in Resend and the `RESEND_API_KEY` connector secret is already stored. Now I'll wire actual email-sending into the app.

## Sender

All emails go from: **`Janice <hello@send.askjanice.net>`**

## What gets built

### 1. Shared email helper
A single server-side helper that all email triggers call:
- Calls Resend through the Lovable connector gateway (no SDK, just `fetch`)
- Uses `LOVABLE_API_KEY` + `RESEND_API_KEY` headers
- Takes `{ to, subject, html, replyTo? }`
- Returns `{ id }` or throws on failure
- Logs failures server-side but never crashes the calling flow (an email failure shouldn't break a booking)

File: `src/server/email.server.ts` (server-only — never imported by client code)

### 2. Branded HTML templates
Small inline-styled HTML builders (no React Email needed — keeps it light). Brand: clean, Janice voice, off-white background, simple header with "Ask Janice".

Templates:
- **Post-call transcript** (to business owner): caller number, call duration, full transcript, AI-extracted lead info if present, link to the conversation in the dashboard
- **Booking confirmation** (to client): appointment date/time, business name, location/notes, "reply to reschedule" line with `reply_to: <owner email>`
- **Generic notification** (reusable for future triggers like contact forms, sign-up welcome, alerts)

File: `src/server/email-templates.server.ts`

### 3. Triggers wired in this pass

| Event | Trigger location | Recipient | Template |
|---|---|---|---|
| Voice call ends (ElevenLabs post-call webhook fires) | `api.public.elevenlabs.postcall.ts` | Business owner (from `profiles.email`) | Transcript |
| Appointment booked via voice agent | `api.public.voice-tools.book-appointment.ts` | Client (email captured during call) + owner gets a copy | Booking confirmation |
| Appointment booked via chat widget | `api.public.widget.chat.ts` (booking tool path) | Client + owner | Booking confirmation |

Each trigger:
- Looks up owner email from `profiles` using the agent's `user_id`
- Sends after the main work succeeds (DB insert / calendar event created)
- Wraps the send in `try/catch` so email failures don't break the call/booking

### 4. Future triggers (NOT in this pass — easy to add later)
Once the helper exists, adding more emails is one line: contact form notifications, password reset branding, new-lead alerts, daily summary, etc. Tell me which you want next.

## Technical notes

- Gateway URL: `https://connector-gateway.lovable.dev/resend/emails`
- Auth: `Authorization: Bearer ${LOVABLE_API_KEY}` + `X-Connection-Api-Key: ${RESEND_API_KEY}`
- Both secrets already exist — no new env vars needed
- `.server.ts` suffix keeps email code off the client bundle
- No new tables needed; transcript content comes from the `conversations` row that the post-call hook already creates

## Out of scope

- Auth emails (password reset / verification) — Supabase still sends those with default branding. Branding those requires the separate Lovable Emails auth-hook flow, which conflicts with Resend on the same subdomain. Leave as-is for now; revisit if you want them branded.
- Marketing / bulk sends — not what Resend transactional should be used for.
