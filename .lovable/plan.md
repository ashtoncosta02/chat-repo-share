Plan: Prepare Ask Janice for real payments (Paddle go-live)

Context
- The app currently runs in Paddle's test/sandbox environment. Real cards are declined until Paddle's go-live checklist is completed.
- Required legal pages for Paddle: Terms & Conditions, Privacy Notice, and a dedicated Refund Policy.
- Current gaps:
  - Terms and Privacy pages still reference Stripe (switched to Paddle).
  - Terms page is missing Paddle's required Merchant of Record disclosure.
  - No dedicated /refund-policy route exists.
  - Go-live status shows all steps as not started / action required.

Steps

1. Update Terms of Service (`src/routes/terms.tsx`)
   - Replace Stripe references with Paddle.
   - Add Paddle Merchant of Record disclosure in the billing section.
   - Ensure seller name reads "Ask Janice" consistently.
   - Keep the 30-day money-back guarantee language.

2. Update Privacy Policy (`src/routes/privacy.tsx`)
   - Replace Stripe with Paddle under data sharing/subprocessors.
   - Add Paddle's role in payment processing, subscription management, tax compliance, and invoicing.
   - Keep all other data-collection and retention language intact.

3. Create Refund Policy page (`src/routes/refund-policy.tsx`)
   - New public route at `/refund-policy`.
   - State a 30-day money-back guarantee.
   - Explain how to request a refund through Paddle (paddle.net) or by contacting hello@askjanice.net.
   - Avoid "no refunds" / "all sales final" language per Paddle requirements.
   - Link from Terms and/or footer if a footer exists.

4. Update landing page / billing copy
   - Scan `src/routes/index.tsx` and `src/routes/dashboard.account.tsx` for any remaining Stripe references.
   - Replace with Paddle copy where found.

5. Publish the app
   - Trigger a publish so the live site uses the production Paddle token.
   - Paddle requires a published site for domain review.

6. Complete Paddle verification
   - Direct the user to the Payments tab to fill out the verification form.
   - Steps: verification form → domain review → business identification → identity verification → final review.
   - Note: live checkout will not accept real cards until all steps are approved.

Acceptance criteria
- `/terms`, `/privacy`, and `/refund-policy` are public, accurate, and mention Paddle (not Stripe).
- Terms includes the Paddle Merchant of Record disclosure.
- Refund Policy offers 30 days and directs users to Paddle.
- App is published and Paddle verification is in progress.

Out of scope
- Changing subscription pricing or product catalog.
- Custom domain changes (already configured).
- New features beyond go-live readiness.