# Submit `calendar.events` justification only

Your console already has the minimal scope set. No code change needed, no scopes to remove. Just fill in **one** justification box.

## What you do in Google Console

1. OAuth consent screen → **Data access** → **Edit**.
2. Find the row for `.../auth/calendar.events`.
3. In its "How will the scope be used?" box, paste:

> AskJanice is an AI receptionist for small businesses. Each business owner connects their own Google Calendar from their dashboard via OAuth. We use the `calendar.events` scope for two purposes:
>
> 1. **Check availability** — When a caller (phone) or website chat visitor asks to book an appointment, we call the Google Calendar `freeBusy` API to read busy time windows on the connected calendar so the AI only offers genuinely available slots.
>
> 2. **Create bookings** — When the caller or visitor confirms a time, we create a single calendar event on the connected calendar with the customer added as an attendee, so Google sends them the invite and reminders.
>
> We do not read, modify, or delete events that the user created outside of AskJanice. We do not share calendar data with third parties. Users can disconnect at any time from their dashboard, which deletes the stored refresh token. This use complies with the Google API Services User Data Policy, including the Limited Use requirements.

4. Save and resubmit for verification.

## Optional supporting items Google often asks for
- Make sure your privacy policy at `askjanice.net/privacy` includes the **Limited Use disclosure** (mention Google user data, that it's only used for the features above, and not transferred to others except as required).
- Record a short demo video showing: sign in → connect Google Calendar from dashboard → a test booking that creates an event. Upload to YouTube (unlisted is fine) and paste the link in the verification form.

Say "go" if you want me to (a) double-check your privacy policy has the Limited Use disclosure, or (b) write you a demo video script.
