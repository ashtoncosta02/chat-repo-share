## What I found for Costa Caulking (info@costacaulking.com)

There is **no backlog**. Comparing the voice provider's call history to your database:

- All calls through **10:44 AM EDT** are stored correctly, one-for-one.
- After that, the provider recorded **exactly one call: 3:21 PM EDT** (14 seconds, 5 exchanges).
- That one call was never saved — no thread, no lead, no transcript email.
- No website-chat conversations exist for this account in the last 2 days.

So a single post-call webhook was dropped. The real problem is that today this failure is silent and permanent: if the webhook request fails or fails signature verification, the call is lost until someone manually runs the backfill tool in Admin.

## Plan

1. **Recover the missing call now** — run the existing backfill for Costa Caulking's receptionist so the 3:21 PM call appears in Threads with transcript and lead. It de-duplicates, so nothing else is affected.

2. **Add an automatic hourly sweep** so this self-heals for every customer:
   - New endpoint `src/routes/api.public.hooks.backfill-calls.ts`, same shape and shared-secret guard as the existing `api.public.hooks.auto-delete-threads.ts`.
   - Loops every receptionist with a linked voice agent, pulls the recent call list, and persists any call the app doesn't already have (reusing `backfillRecentCalls`).
   - Scheduled hourly via the same cron mechanism as the existing hook.

3. **Make webhook failures visible instead of silent**
   - Log a clear warning whenever a call is rejected for signature/verification reasons, including the conversation id, so it's searchable.
   - On the Admin health page, show a "calls recovered by backfill in last 24h" counter so a recurring problem becomes obvious.

4. **Notifications for recovered calls** — recovered calls run through the same lead-capture and transcript-email path, marked as recovered so a late email isn't confusing.

### Technical notes
- `backfillRecentCalls` filters to `status === "done"`; the missed call qualifies.
- The sweep reuses `persistPostCall`, which de-duplicates on `elevenlabs_conversation_id`.
- No schema changes; the counter derives from existing `conversations` rows.
