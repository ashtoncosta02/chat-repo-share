## Goal
Reduce the "ring my cell first" window so the AI takes over before your carrier voicemail can pick up.

## Change
In `src/routes/api.public.twilio.voice.ts`, change the `<Dial>` timeout from `20` to `15` seconds (roughly 2–3 rings). If your cell doesn't answer in 15s, Twilio cancels the leg and routes the caller to Janice via the existing fallback route.

## Why this helps
Most carrier voicemails answer between 20–30 seconds. Cutting the timeout to 15s means Twilio almost always gives up before voicemail answers, so we sidestep the AMD guesswork entirely.

## Trade-off
You get less time to grab your phone (~2 rings instead of ~3–4). If you'd rather try 18s as a compromise, say the word.

## Note
Keeping machine detection on as a safety net for the edge case where voicemail still picks up early. No other files change.