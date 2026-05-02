## What I'll do

1. **Request the `ELEVENLABS_WEBHOOK_SECRET` secret from you in chat.** This will show a secure input box right in the chat where you paste:

   ```
   wsec_1c0b304602114849365231b0e6365e76873df232563a507ec957f39b712fb075
   ```

   Click Submit and it's saved — no settings page hunting required.

2. **That's it on my end** — no code changes needed. The webhook handler (`src/routes/api.public.elevenlabs.postcall.ts`) already reads `process.env.ELEVENLABS_WEBHOOK_SECRET` and will start verifying ElevenLabs signatures as soon as the secret is in place.

## After it's saved

- **New phone calls** → transcript saves to **Conversations** automatically (~30s after hangup) and a **Lead** is created with the caller's phone as fallback.
- **Existing test calls** → go to **Dashboard → Conversations** and click **"Import recent calls"** to pull them in via the backfill we built last turn.

Approve this and I'll fire the secret popup immediately.