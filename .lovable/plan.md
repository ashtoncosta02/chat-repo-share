## Why no email arrived

Two separate problems, both real:

### 1. Your "Email transcript" toggle isn't saving
I checked your receptionist in the database: `notify_email_transcript` is still `false` and `notify_email` is empty — even though you flipped the switch on. That's why the post-call code skipped sending entirely (the call itself was received and transcript saved correctly).

The session replay confirms it: you toggled the switch on, navigated away, came back, and the switch had reset to off. The update is silently failing — almost certainly because the Notifications page writes directly from the browser using the Supabase client, and on this app auth is handled by Clerk, so that browser write isn't authenticated as you and RLS rejects it (with no error toast, because Supabase returns "0 rows updated" rather than an error).

### 2. Misleading helper text
The card still says *"Delivery turns on once we wire up the integration — your preferences are saved."* That's stale — Resend is wired up now. It needs to go.

---

## Fix plan

1. **Move the notifications save to the server.**
   Create `updateAgentNotifications` as a `createServerFn` (auth-protected, runs as the user via `requireSupabaseAuth`) that updates `notify_email_transcript`, `notify_sms_transcript`, `notify_email`, `notify_phone` for the caller's agent. Replace the direct `supabase.from('agents').update(...)` calls in `NotificationsCard.tsx` with calls to this server fn. Show a toast on success/failure so a silent failure can't happen again.

2. **Fix the helper copy.**
   Remove the "once we wire up the integration" line. Replace with: *"Saved automatically. Transcripts are sent from hello@send.askjanice.net after every call."*

3. **Auto-fill the email field.**
   When `notify_email` is null, pre-fill the input with the user's account email (from `profiles.email`) so one tap on the toggle is enough.

4. **Add a "Send test email" button.**
   Small button under the email row. Calls a new server fn `sendTestTranscriptEmail` that renders the transcript template with fake data and sends it to whatever address is currently saved. Lets you confirm Resend → inbox works end-to-end without needing to place another phone call.

5. **Verify after deploy.** Toggle the switch on with your address, click "Send test email", confirm it arrives. Then we know the next real call will email too.

### Out of scope
- I'm not touching the post-call email logic itself — it's correct, it just never ran because the flag was off. Once the toggle persists, your next call will email the transcript automatically.
- SMS path (you didn't ask for it; same persistence fix will cover it as a side effect though).