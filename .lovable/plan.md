Reopen the secure secret prompt for `ELEVENLABS_WEBHOOK_SECRET` so you can paste the correct HMAC signing secret (the one starting with `e019f...`) from your ElevenLabs Post-call Webhook settings.

After you save it, the `/api/public/elevenlabs/postcall` endpoint will pass HMAC signature verification, and ElevenLabs post-call webhooks will start saving transcripts and creating leads.

No code changes needed — just updating the secret value.