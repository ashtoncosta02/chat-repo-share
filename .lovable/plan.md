# Plan: Owner tools + Account menu cleanup

Three independent pieces, in priority order.

## 1. Remove duplicate "My Account" from sidebar (quick win)

`AccountMenu` already lives in the top-right of the dashboard (desktop top bar + mobile header). The old "My Account" / sign-out block at the bottom of the sidebar is leftover and forces scrolling on long pages like Threads.

- `src/routes/dashboard.tsx`: delete the bottom `<div className="border-t … px-6 py-4">` block in both the desktop sidebar (lines ~146–157) and the mobile drawer (lines ~208–219).
- Result: `AccountMenu` (top-right avatar dropdown → Account, Change email, Change password, Billing, Sign out) becomes the single, always-visible entry point on every page.

## 2. Owner impersonation ("Sign in as this client")

Goal: from the Admin → Users page, you (an admin) can open any client's account exactly as they see it, to help with tickets/issues, then return to your own account.

How it works (technical section, see below for the safer design):

- Add a server function `adminImpersonateUser({ userId })` that:
  - Verifies the caller is signed in **and** has `app_role = 'admin'` via `has_role()`.
  - Uses `supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email })` to mint a one-time magic link for the target user.
  - Writes an audit row to a new `admin_impersonation_log` table (admin_user_id, target_user_id, created_at, reason).
  - Returns the magic-link URL.
- Add an **"Open as user"** button on `dashboard.admin.users.$userId.tsx`. Clicking it:
  - Stores your current admin session token in `sessionStorage` under `aj.adminReturnSession`.
  - Signs out your current session and redirects to the magic link → you land in the client's dashboard as them.
- Add a persistent yellow banner at the top of the dashboard (rendered in `dashboard.tsx`) that appears whenever `sessionStorage.aj.adminReturnSession` exists:
  - "You are signed in as **client@email.com**. [Return to admin]"
  - "Return to admin" restores the saved session via `supabase.auth.setSession(...)` and clears the flag.
- New table (migration):
  ```
  admin_impersonation_log(id, admin_user_id, target_user_id, reason text null, created_at)
  ```
  RLS: only admins can SELECT; INSERT only via the server function (service role).
- Add a short paragraph to `/terms` and `/dashboard/account` noting that admins may access accounts to provide support, for transparency.

Notes / trade-offs to confirm with you:
- Magic-link flow is the standard, audit-safe approach. The alternative ("ghost session" where admin keeps their own session and just views the user's data) requires rewriting every server function to accept a `viewAsUserId`, which is a much bigger change.

## 3. Re-evaluate the Owner (Admin) dashboard

Today `/dashboard/admin` shows: Users, Receptionists live, Chat conversations, Voice calls, Bookings, Leads, Phone numbers, Calendars connected, plus new‑7d users/leads, upcoming bookings, recent signups.

That's a good operational snapshot but is missing what a SaaS owner actually needs to run the business. Proposed additions, grouped:

**Revenue & growth (placeholders until Stripe is wired)**
- MRR, ARR, ARPU — show "—" with a "Connect Stripe" hint for now, real numbers later.
- Trial → paid conversion, churn (also pending Stripe).
- Signups this week vs last week (with % change arrow).
- Activation rate: % of signups who completed onboarding (have an agent + phone number).

**Product health**
- Active receptionists in last 7d (had ≥ 1 call or chat) vs total → tells you who is actually using it.
- Calls today / this week, chats today / this week, bookings today / this week (with sparkline trend).
- Avg call duration, avg messages per chat conversation.
- Failed / error calls in last 24h (from `conversations.status`).

**Support load**
- Open tickets count, oldest open ticket age, tickets closed this week. Link to `/dashboard/admin/tickets`.

**Infrastructure / cost watch**
- ElevenLabs voice minutes used this month (estimated from call durations).
- Twilio numbers provisioned this month (proxy for cost).
- Lovable AI token usage if exposable.

**At‑risk accounts list (replaces / complements "Recent signups")**
- Users with: no agent live, no phone number, onboarding incomplete > 3 days, or zero activity in 14 days. Click → admin user detail → "Open as user".

**Layout**
```text
[ Revenue row — MRR / ARR / Signups Δ / Activation % ]
[ Today row — Calls / Chats / Bookings / Failed ]
[ Health row — Active receptionists / Avg call / Avg chat / Voice min ]
[ Support row — Open tickets / Oldest ticket / Closed 7d ]
[ At-risk accounts list ]   [ Recent signups list ]
```

I'd implement this in `dashboard.admin.index.tsx` and extend `getAdminOverview` in `src/lib/admin.functions.ts` to return the new metrics. Revenue tiles render as "—" until Stripe lands (already on the roadmap, after custom domain).

---

## Order of work

1. Delete the bottom "My Account" block from the sidebar (5 min, fixes the immediate UX pain).
2. Build impersonation: migration → server fn → admin button → return-to-admin banner.
3. Expand the admin dashboard with the metrics above (revenue tiles as placeholders).

## Questions before I start

- Impersonation: OK with the magic-link approach (you actually sign in as them, then click "Return to admin" to come back)? Or do you want me to skip impersonation for now and just add a read-only "View their data" page?
- Owner dashboard: any of the proposed sections you want to drop, or anything specific I'm missing (e.g. NPS, refund requests, specific cost lines)?
