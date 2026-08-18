# Fix signup deadlock and admin stats crash

## Issue 1: New visitors cannot sign up from marketing pages

**Problem:** The `/auth` page only renders a Sign in tab. The Sign up tab content exists but has no visible trigger, so marketing CTAs that send anonymous visitors to `/auth` land them on a dead-end sign-in screen. No new visitor can create an account or reach the Stripe/agent onboarding flow.

**Fix:**
- Restore the Sign up tab trigger on `/auth` so both tabs are visible again.
- Ensure marketing CTAs pass `mode=signup` when the user is anonymous, so the signup tab is active by default.
- Keep the existing sign-in behavior unchanged for returning users.

## Issue 2: Admin dashboard stats query crashes on missing `conversations.status`

**Problem:** The admin overall-statistics query filters conversations by `.in("status", ["failed", "error"])`, but the `conversations` table has no `status` column. The query throws a Postgres error and the admin dashboard stats fail to load.

**Fix:**
- Remove the `status` filter from the admin stats query in `src/lib/admin.functions.ts`.
- Verify the admin dashboard loads and shows the correct conversation counts afterward.

## Outcome

- New visitors can click **Get started** and actually create an account.
- The admin dashboard statistics load without errors.
- No other features are changed.
