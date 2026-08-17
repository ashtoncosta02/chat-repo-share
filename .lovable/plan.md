# 7-day free trial, then upgrade wall

## Why your own account shows no upgrade prompt

Two reasons, both real gaps rather than bugs in Stripe:

1. The David Costa account (info@costacaulking.com) is on a comped trial that runs until **Oct 5, 2026**, so nothing prompts for payment yet.
2. The only place an upgrade button exists today is **My Account → Subscription & billing**. There is no trial countdown or upgrade call-to-action anywhere else in the dashboard.

There is also a bigger gap: brand-new self-signups are created with billing status `active`, not `trial`. That means a new customer today would never hit a trial deadline and would never be asked to pay.

## What will change

**New signups get a real 7-day trial**
- On signup, the account is stamped as a trial ending 7 days later.
- Existing accounts are untouched (your comped and unlimited accounts stay as they are).

**Trial countdown banner with upgrade button**
- A slim bar at the top of every dashboard page: "6 days left in your free trial — Upgrade to Elite $97/mo".
- The button opens Stripe checkout right there; no digging through the account page.
- Turns amber/urgent in the last 2 days.
- Disappears the moment a paid subscription is active, and never shows for unlimited/comped accounts or admins.

**When the trial ends**
- The dashboard locks to the existing "Your plan has ended" upgrade screen (this already works, it just was never reachable because nobody was on a real trial).
- Copy is updated to "Your free trial has ended" when the account never had a paid plan.
- Paying restores access immediately via the Stripe webhook already in place.

**Admin control stays**
- Your existing admin trial controls (extend N days, unlimited, mark expired) keep working and now visibly drive the customer-facing banner.
- Your own admin account is unaffected — admins are never gated.

## Technical notes

- Add `TrialBanner` component reading `profiles.billing_status / trial_ends_at / trial_unlimited` plus `useSubscription`, rendered inside the dashboard layout above the outlet.
- Reuse `useStripeCheckout` + `ELITE_PRICE_ID` for the banner CTA (same flow as `BillingSection`).
- Set the trial at account creation: update the profile-creation path so new rows get `billing_status='trial'`, `trial_ends_at = now() + 7 days`, `trial_unlimited=false` (DB default for `billing_status` also changed from `active` to `trial` so nothing slips through).
- No changes to Stripe products, prices, keys, or the live go-live configuration.
