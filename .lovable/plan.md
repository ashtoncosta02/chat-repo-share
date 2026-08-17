# Card-on-file 7-day free trial, then auto-billing

You're right — the standard SaaS pattern is: collect the card up front, give 7 free days, then charge automatically unless they cancel. That's what this plan does.

## Why your own account shows no upgrade prompt

1. The David Costa account (info@costacaulking.com) is on a comped trial that runs until **Oct 5, 2026**, so nothing prompts for payment.
2. The only upgrade button today lives in **My Account → Subscription & billing** — no countdown or CTA anywhere else.
3. Brand-new self-signups are created with billing status `active`, so a new customer today would never hit a deadline and never be asked to pay.

## How the new flow works

**Signup → card → trial**
- After the onboarding wizard, a new account lands on a "Start your 7-day free trial" screen with embedded Stripe checkout.
- Stripe collects the card but charges **$0 today**; the subscription starts in `trialing` for 7 days, then bills $97/mo automatically.
- Until the card is on file, the dashboard stays behind that screen (same gate already used for expired plans).
- Cancel any time inside the 7 days and nothing is charged.

**Trial countdown banner**
- Slim bar at the top of every dashboard page: "6 days left in your free trial — you'll be charged $97/mo on Aug 24. Manage billing".
- Turns amber in the last 2 days.
- Disappears once the subscription is fully active/paid; never shows for unlimited/comped accounts or admins.
- "Manage billing" opens the Stripe customer portal so they can cancel or swap cards themselves.

**When the trial converts or fails**
- Stripe charges on day 7 and the webhook flips the account to active — no user action needed.
- If the card fails, the account goes past due: a red banner with "Update payment method" appears, and access locks after Stripe's retries are exhausted.

**Admin control stays**
- Your existing admin trial controls (extend N days, unlimited, mark expired) keep working, and comped accounts skip the card screen entirely.
- Admin accounts are never gated.

## Technical notes

- `createCheckoutSession` gains `subscription_data.trial_period_days: 7` plus always-collect payment method for the trial flow, so Stripe holds the card and auto-charges at trial end. No new product or price — still `elite_monthly` at $9700.
- Webhook already handles `customer.subscription.created/updated`; `trialing` counts as entitled, `past_due` shows the dunning banner, `canceled`/`unpaid` locks.
- New `TrialBanner` component reads `useSubscription` (status + trial end) plus `profiles.trial_unlimited`, rendered in the dashboard layout above the outlet.
- New "Start free trial" gate screen reuses `StripeEmbeddedCheckout`; shown when the account has no Stripe subscription and isn't comped/unlimited/admin.
- Profile defaults change from `billing_status='active'` to a pending-trial state for new signups so nobody slips through; existing rows untouched.
- No changes to Stripe keys, products, or the completed go-live configuration.
