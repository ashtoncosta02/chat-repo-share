# Complete Stripe go-live and checkout integration

## Current state

Stripe sandbox is already claimed (account `acct_1U1ZeyAwpPGWs6dA`). The next step is Stripe's go-live form, which includes adding a bank account for payouts.

## Plan

### 1. Finish Stripe account setup first

Yes — add the checking account now. Stripe will not let you accept live payments or send payouts until a bank account is linked. This happens inside Stripe's "Activate your account" flow, not in Lovable.

You'll also complete in the same flow:
- Business type and details
- Public business info (statement descriptor, support phone/email)
- Two-step authentication
- Review and submit

### 2. Install the Lovable app on the live Stripe account

After Stripe onboarding is submitted, the dashboard will show an "Install Lovable app" step. Clicking it authorizes Lovable to create checkout sessions and read subscription events from the live account.

### 3. Let Lovable provision live API keys

Once the app is installed, Lovable automatically creates live API keys and webhook endpoints. No manual copy/paste is needed.

### 4. Run the readiness check

The Payments tab will unlock a readiness check that validates products, prices, webhooks, and keys.

### 5. Verify the app checkout flow

Test the Elite plan checkout in preview with Stripe's test card (`4242 4242 4242 4242`), then confirm the live flow after go-live completes.

### 6. Tax and compliance handling

Ask Janice sells AI receptionist software (a digital/SaaS product). If the Stripe account is in a supported country, configure checkout to use Lovable's managed Stripe handling so tax, fraud, disputes, and transaction support are covered for buyers in supported countries. This adds +3.5% per transaction and shows `LINK.COM*` on bank statements.

## What you need to do now

Open the Payments tab and continue the in-progress "Complete the go-live form on Stripe" step. Add your checking account there.

<presentation-actions><presentation-open-payments>Go to payments</presentation-open-payments></presentation-actions>
