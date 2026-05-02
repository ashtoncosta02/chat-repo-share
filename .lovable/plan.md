# Add booking tools to the voice receptionist

Give the voice agent the ability to check availability and book appointments on your Google Calendar — same as the chat widget does today. No changes to voice quality, latency, or how calls sound.

## What changes

1. **Two new public webhook endpoints** the ElevenLabs voice agent will call mid-conversation:
   - `POST /api/public/voice-tools/find-slots` — returns available time slots for a date range
   - `POST /api/public/voice-tools/book-appointment` — creates the calendar event and saves the booking

   Both are scoped by `agent_id` (passed in the request) and use the existing `agent_google_calendar` connection + business hours.

2. **Reuse existing booking logic** from `src/server/widget-booking-tools.ts` — extract the core "find slots" and "create booking" helpers into `src/server/booking-core.server.ts` so both the widget and voice agent share the same code (no duplicate logic, no drift).

3. **Update ElevenLabs agent config** in `src/server/elevenlabs-agent.server.ts`:
   - Add two `webhook` tools to the agent definition (alongside the existing `end_call` tool)
   - Each tool has a name, description, and JSON schema for parameters (date range, name, phone, slot time, reason)
   - When you save your receptionist, the new tools get pushed to ElevenLabs automatically

4. **Update the system prompt** so the agent knows:
   - It can offer to book appointments
   - It must collect caller name + phone before booking
   - It should confirm the time back to the caller before calling `book_appointment`
   - If no calendar is connected, it falls back to taking a message (current behavior)

## What does NOT change

- Voice (still Liam or whatever you picked)
- Call latency / response speed
- Voicemail flow
- The "Liam answering" experience
- Chat widget booking (keeps working identically)

## Edge cases handled

- **No Google Calendar connected**: tools simply aren't registered for that agent — the agent won't try to book and will take a message instead
- **Slot already taken between offer and confirm**: `book_appointment` re-checks availability; if conflict, returns error and agent re-offers
- **Outside business hours**: `find_available_slots` already filters by your configured hours
- **Caller doesn't give a phone**: tool requires it; agent will ask before booking

## Bookings dashboard

Voice-booked appointments appear in your existing `/dashboard/bookings` page automatically (same `calendar_bookings` table, just `source = 'voice'` instead of `'widget'`).

## Cancellation

Skipped for now — you mentioned waiting on email for the cancel link. We can add a simple "cancel from dashboard" button in the meantime if you want, or wait until email is set up. Let me know.

## Memory update

Update the core memory to remove the outdated "voice rework deferred" note and reflect that voice booking is live.
