I agree with you: voice calls should absolutely create leads. The current issue is not that this is a bad idea — it is that the voice webhook path is incomplete/misconfigured.

What I found:
- The app already has a post-call endpoint at `/api/public/elevenlabs/postcall` that can save transcripts into `conversations` and `messages`.
- The ElevenLabs workspace webhook currently points to the wrong production URL:
  `https://project--d1e796ad-671c-47e1-843b-cdecc02fe11f.lovable.app/...`
  That project is not published, so ElevenLabs is getting 404s and never reaches the app.
- The actual preview URL that currently accepts the webhook is:
  `https://project--d1e796ad-671c-47e1-843b-cdecc02fe11f-dev.lovable.app/api/public/elevenlabs/postcall`
- The individual ElevenLabs agent has `post_call_webhook_id: null` in its agent override settings. The workspace setting exists, but I want to remove ambiguity by making sure the workspace/agent configuration uses the active webhook reliably.
- The post-call endpoint currently saves transcripts only. It does not call the existing lead extraction helper, so non-booking phone calls will not become leads yet. Bookings can create leads through the booking tool, but general phone-call lead capture is missing.

Plan:

1. Fix the ElevenLabs webhook configuration
   - Update the existing ElevenLabs workspace webhook URL to the working preview webhook URL.
   - Keep retries enabled.
   - Keep HMAC verification enabled using the saved webhook secret.
   - Confirm the configured webhook no longer shows recent 404 failures.

2. Harden the post-call webhook handler
   - Accept only the real `post_call_transcription` payload for transcript saving.
   - Keep idempotency by `elevenlabs_conversation_id`, so retries do not create duplicates.
   - Add clearer logging for these cases:
     - missing signature
     - bad signature
     - missing agent/conversation id
     - agent not found
     - transcript inserted
     - lead extracted/updated
   - Keep returning `200` for non-retryable “agent not found” cases so the provider does not retry forever.

3. Add voice-call lead extraction
   - Reuse/refactor the existing widget lead extraction logic so it works for both widget chats and phone calls.
   - After saving the voice transcript, run lead extraction on the transcript.
   - Create/update a lead with:
     - `source: "voice"`
     - `conversation_id` linked to the saved conversation
     - extracted name, phone, email, and notes
     - `last_message_at` set to the call end/save time
   - If the call includes booking details, preserve/booked lead status where appropriate instead of overwriting it incorrectly.

4. Add a fallback backfill/sync path for missed calls
   - Add a server-side maintenance function that can fetch recent completed ElevenLabs conversations from the provider API and save any that were missed by the webhook.
   - Use this once immediately after implementation to pull in your recent test calls, so you do not need to wait for only future calls.
   - This also gives us a safety net if a webhook delivery is missed again.

5. Fix the visible dashboard blocker from the recent logs
   - The preview server log shows a syntax/runtime issue around `dashboard.leads.tsx` from the previous state. I will inspect and fix that if it is still present, because a broken Leads route can make it look like leads are not saving even if backend rows exist.

6. Verification
   - Test the webhook endpoint with a correctly signed sample post-call payload and confirm it writes:
     - one `conversations` row
     - matching `messages` rows
     - one `leads` row with `source = voice`
   - Query the database to verify recent saved calls/leads.
   - Re-check the external webhook configuration.
   - Backfill recent completed calls from ElevenLabs, then verify they appear in Conversations/Leads.

Expected result:
- New phone calls save transcripts automatically after the call ends.
- Phone calls create/update leads automatically, even when the caller does not book.
- Booked callers still show as leads.
- Recent calls that were missed because the webhook pointed at the wrong URL can be imported instead of lost.