# Roadmap: Higher-Value Features

Ordered so the most impactful customer-facing work ships first, your private admin dashboard comes near the end, then domain, with voice rework parked for last.

---

## 1. Lead capture polish (next up — "must-do")

The widget already chats and books, but visitors who don't book often still share a name/email mid-conversation. Right now those don't reliably land in the `leads` table or surface anywhere useful.

**What we'll build**
- Auto-extract name/email/phone from widget chats (server-side, after each visitor message) and upsert into `leads` with `agent_id` + source.
- Link leads to `widget_conversations` so you can jump from a lead → full chat transcript.
- Upgrade `dashboard.leads.tsx`: search, filter by agent, show last message preview, "View conversation" link, mark as contacted/won/lost.
- Also pull customer info from `calendar_bookings` so booked customers show as leads too (deduped by email).

**Why now:** Bookings + leads = the core business value of the widget. Without this, customers can't see ROI.

---

## 2. Agent analytics (per-agent performance)

Customer-facing analytics so each user sees how their agent(s) perform.

**What we'll build**
- New `dashboard.analytics.tsx` (route exists — currently empty/basic).
- Per-agent cards showing: conversations (7d / 30d), messages, leads captured, bookings made, conversion rate (conversations → bookings).
- Simple time-series chart (recharts) of conversations and bookings over the last 30 days.
- Top pages widget loaded on (from `widget_conversations.page_url`).

**Why:** Customers need proof the agent is working to keep paying.

---

## 3. Onboarding + billing gate

Right now anyone can sign up and use everything. To make this a real product:

**What we'll build**
- Onboarding flow: after signup, walk new users through (1) create first agent → (2) connect Google Calendar → (3) install widget snippet. Progress checklist on the dashboard until complete.
- Stripe subscription (use the Stripe connector). Single plan to start, e.g. "Pro — $X/mo" with a 7-day trial.
- `subscriptions` table tracking status. Gate widget chat + bookings behind active subscription (return polite "service unavailable" from `/api/public/widget/chat` if owner's subscription is past_due/canceled).
- Billing page: current plan, manage via Stripe customer portal.

**Why:** Without billing, this isn't a business. Onboarding lifts activation — most users abandon products before connecting the value-creating piece (calendar + widget install).

---

## 4. Email notifications

Owner + customer emails so people aren't surprised by bookings.

**What we'll build**
- When a booking is created (widget OR manual): send confirmation email to customer (already partially happening via Google Calendar invite — add a branded follow-up) and a "new booking" alert to the agent owner.
- Daily digest email to owner: bookings today, new leads, conversations count.
- Use Resend via the existing infra.

**Why:** Trust + retention. Owners want to know their AI is working without checking the dashboard.

---

## 5. Private admin dashboard (just for you)

A separate area only you can access to monitor the whole app.

**What we'll build**
- `user_roles` table + `has_role()` security definer function (the proper RLS pattern — never store roles on profiles).
- Seed your user with the `admin` role.
- New route group `dashboard.admin.*` gated by an admin-check loader that redirects non-admins.
- **Overview page:** total users, active users (7d/30d), total agents, conversations, bookings, MRR (from Stripe), subscription breakdown (trial / active / churned).
- **Users page:** list of all users with signup date, last active, # agents, # conversations, # bookings, plan status. Click into a user to see their agents and recent activity.
- **Agents page:** all agents across all users, sortable by usage.
- **System health:** recent errors (from a lightweight `error_logs` table we'd add), edge function failure rates, Lovable AI usage trend.
- **Revenue page:** MRR over time, new subs, churn, trial → paid conversion.

**Why at the end:** It's pure observability — needs the other features to exist first to be worth viewing. Doesn't ship value to your customers.

---

## 6. Custom domain

Get the app onto your own domain.

**What we'll do**
- Help you configure the custom domain in Lovable settings.
- Update OAuth redirect URIs (Google Calendar, Supabase auth) to include the new domain.
- Update widget embed script + CORS config so embeds keep working.
- Update any hardcoded URLs (`NEXT_PUBLIC_SITE_URL` secret, email templates, OAuth callbacks).

**Why near-end:** Easier to do once flows are stable so we don't have to repeat URL changes mid-development.

---

## 7. Voice rework (deferred — last)

Already in memory as parked. Will revisit with Twilio Media Streams + realtime LLM/TTS or a dedicated voice provider (Vapi/Retell/LiveKit) when we get there.

---

# Suggested execution order

1. Lead capture polish ← **start here**
2. Agent analytics
3. Onboarding + Stripe billing
4. Email notifications
5. Admin dashboard (your private view)
6. Custom domain
7. Voice rework

Each item is a self-contained chunk we can ship and validate before the next. Approve this and I'll start with **Lead capture polish**.
