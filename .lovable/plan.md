## Goal

When a customer reports "something isn't working," you need to look at their account and immediately see what's wrong — failing calls, broken integrations, missing config, errors. Today the admin pages only show counts. I'll turn the admin area into a real support console.

## What I'll add

### 1. New "User detail" admin page (`/dashboard/admin/users/:userId`)
Click any user from the users table → opens a full diagnostic view of their account:

- **Account** — email, name, signup date, last sign-in, admin flag, ability to impersonate-view (read-only)
- **Receptionist health** — business name, live/draft, onboarding step, ElevenLabs agent linked?, voice configured?, system prompt present?
- **Phone numbers** — each number with: Twilio status, linked to ElevenLabs?, webhook URL set?, last inbound call timestamp. Red badge if misconfigured + one-click "Re-sync to AI" button.
- **Google Calendar** — connected?, token expired?, business hours configured?, last successful booking, last booking error
- **Chat widget** — embed snippet, last 10 conversations with status, link to view transcript
- **Voice calls** — last 20 calls: timestamp, from, duration, status (completed / failed / no-answer), link to transcript + audio. Flags calls with no transcript saved (webhook misfire).
- **Leads** — last 20 leads with source (chat / voice / manual)
- **Bookings** — upcoming + recent, with status
- **Recent errors** — pulled from `email_send_log` failures + any `*_error` columns on conversations/bookings

### 2. New "System health" admin page (`/dashboard/admin/health`)
App-wide signals so you can spot problems before users report them:

- **Voice pipeline** — calls in last 24h, % completed, % missing transcripts (webhook failures), avg duration
- **Chat widget** — conversations in last 24h, errors, AI gateway failures
- **Bookings** — created in last 24h, failed booking attempts (from voice tool logs)
- **Integrations** — count of users with: ElevenLabs linked, Twilio number, Google Calendar connected, expired Google tokens (needs reconnect)
- **Email log** — last 50 emails sent (deduplicated by `message_id`), with filters for status/template. Per the email dashboard spec: time range filter, template filter, status filter, summary stats, sortable table.
- **Backfill button** — manually trigger ElevenLabs call backfill for any user (already exists per-user, expose globally here too)

### 3. Enhancements to existing users list
- Add columns: **Status** (✓ healthy / ⚠ misconfigured / ● inactive 30d), **Last activity**
- Status badge is red if: agent not live, no phone number, calendar token expired, or onboarding incomplete >7 days after signup
- Each row links to the new user detail page
- Sort by last activity / status / created date

### 4. New server functions (in `src/lib/admin.functions.ts`)
All gated by `requireAdmin`:
- `getAdminUserDetail({ userId })` — aggregates everything for one user
- `getSystemHealth()` — app-wide signals
- `getRecentEmailLog({ filters })` — for email panel
- `getRecentErrors({ userId? })` — pulls failed bookings, failed calls, suppressed emails
- `adminBackfillUserCalls({ userId })` — wraps existing backfill for any user

## Technical notes

- All data via `supabaseAdmin` inside server functions (RLS bypass, admin-gated)
- No new tables needed — joins existing `agents`, `phone_numbers`, `agent_google_calendar`, `conversations`, `widget_conversations`, `calendar_bookings`, `leads`, `email_send_log`
- One new route file: `src/routes/dashboard.admin.users.$userId.tsx`
- One new route file: `src/routes/dashboard.admin.health.tsx`
- Update `src/routes/dashboard.admin.tsx` to add nav links to Health page
- Update `src/routes/dashboard.admin.users.tsx` to add status column + row click

## Out of scope (ask if you want these too)

- Actually impersonating a user (signing in as them) — risky, skipping unless requested
- Live tailing of server logs in the UI — complex, can add later
- Push notifications/alerts when a user's account breaks
