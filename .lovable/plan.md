# Stop calls from silently disappearing

You say the key you pasted is the correct one. Rather than going back and forth on it, the plan below both **proves** whether the saved key works and **removes the single point of failure** that let these calls vanish in the first place.

## What actually happened

Every incoming call currently has to survive two checks before it becomes a thread:

```text
Call ends -> ElevenLabs posts transcript -> signature check
   signature valid?  -> save thread
   signature invalid -> fall back to ElevenLabs API using the saved key
                         API 401 -> reject with 401, thread is LOST
```

Right now the signature check is failing (so every call takes the fallback path), and the fallback is returning 401. Two broken things stacked on top of each other, and the result is a silently dropped call with no alert.

## Step 1 — Prove the key one way or the other

Add a read-only "ElevenLabs connection" check on the Admin Health page. It calls a harmless ElevenLabs endpoint with the saved key and reports back:

- Connected — shows the account name and the key's masked last 4 characters
- Rejected — shows the exact error ElevenLabs returned and the key's prefix (e.g. `202…` vs `sk_…`), no secret ever displayed

This settles the question in one click instead of guessing. If it reports Connected, the key is fine and the problem is entirely the signature secret in Step 2.

## Step 2 — Fix the signature check (the real root cause)

The webhook signing secret saved in the app doesn't match the one ElevenLabs is signing with, which is why every call is being pushed onto the fragile fallback path. Add a matching health check for the webhook secret, and once verified, correct the stored value so signatures validate directly. After that, transcripts save without needing the API key at all.

## Step 3 — Never lose a call silently again

- **Never reject a real call.** If both checks fail, the webhook stops returning 401 and dropping the payload. It saves the raw payload to a `webhook_failures` table and returns 200, so ElevenLabs doesn't discard it. Nothing is ever thrown away again.
- **Admin alert.** Any failure shows a red banner on Admin Health with the count and the reason, plus an email to you. You find out in minutes, not days.
- **One-click replay.** A "Replay failed webhooks" button turns those stored payloads into real threads once the credential is fixed — no dependency on the ElevenLabs API being reachable.
- **Re-enable the hourly sweep** (currently paused) with the existing silent/age guard, so it quietly catches stragglers without texting customers about old calls.

## Step 4 — Recover today's missing calls

Once Steps 1–2 confirm working credentials, run the recovery sweep to pull in today's 7:24 AM and 7:26 AM calls plus anything else missed, with notifications suppressed so no customer gets a surprise text.

## Technical notes

- New route `src/routes/api/admin/elevenlabs-health` (admin-gated) probing `GET /v1/user` and `GET /v1/convai/settings`; returns status + masked prefix only, never the secret.
- New table `public.webhook_failures` (payload jsonb, reason, agent hint, created_at, replayed_at) with RLS restricted to admins plus GRANTs for `authenticated`/`service_role`.
- `api.public.elevenlabs.postcall.ts`: replace the 401 return with persist-to-`webhook_failures` + 200.
- Replay reuses the existing `persistPostCall` with the `silent` flag.
- Re-arm the `backfill-missed-calls-hourly` cron job via migration.
