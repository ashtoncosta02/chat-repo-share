# Send chat transcripts without an extra 5-minute job

You're right — a job waking the database every 5 minutes just to look for finished chats is more than this needs. We can get the same result with no new recurring work at all.

## How it will work instead

1. **Piggyback on chat traffic.** Every time a visitor sends a message to the chat bot, the app already runs a request. At the end of that request it will also check whether any *other* chat has gone quiet long enough and send those transcripts. Busy sites get transcripts out quickly at no extra cost.

2. **Reuse a job that already runs.** The last chat of the day has no follow-up traffic to ride on, so it needs a backstop. Instead of a new job, the existing missed-calls job (already running every 15 minutes) will also sweep for quiet chats. Nothing new is scheduled, nothing extra wakes the database.

3. **Delete the 5-minute job.** The `widget-chat-transcript-digest` schedule is removed.

Worst case, the very last chat of a quiet period is emailed up to about 15 minutes after it ends instead of 5 — still the full transcript, still one email per chat.

## Technical details

- Move the sweep body from `src/routes/api.public.hooks.widget-chat-digest.ts` into a shared helper, e.g. `src/server/widget-chat-digest.server.ts`, exporting `sweepIdleWidgetChats()` with the current logic (4-minute idle, ≥2 visitor turns, `notified_at is null`, 24h window, limit 50).
- Keep the existing route as a thin wrapper around the helper so it can still be triggered manually, with the cron-secret check unchanged.
- In `src/routes/api.public.widget.chat.ts`, after the response stream completes, call `sweepIdleWidgetChats()` guarded by try/catch so a failure never affects the visitor's chat.
- In `src/routes/api.public.hooks.backfill-calls.ts`, call `sweepIdleWidgetChats()` after the call backfill work and include its count in the JSON response.
- Unschedule the pg_cron job `widget-chat-transcript-digest` (jobid 59) via migration.
- `notified_at` remains the single guard against duplicate emails, so overlapping triggers are safe.
