# Admin: Stripe billing health & transactions

Add a **Billing** page in the admin area that shows how payments are actually performing, plus a compact Stripe status tile on the existing Admin Health page.

## KPIs shown

Top row of stat cards (live environment, with a test/live toggle):

- **MRR** — sum of active + trialing subscriptions
- **Active subscribers** — active + trialing count
- **Trialing** — count (early signal of upcoming revenue)
- **Past due / unpaid** — count, highlighted red (money at risk right now)
- **Canceled this month** — churn signal
- **Revenue last 30 days** — sum of paid invoices/charges
- **Failed payments last 7 days** — count of failed charges

## Transactions list

A recent-transactions table (last 50), each row showing: date, customer email, amount, status (paid / refunded / failed / pending), plan, and a link to the receipt/hosted invoice. Filterable by status so you can jump straight to failures and refunds.

Below it: **Active subscriptions** list — customer, plan, status, current period end, cancel-at-period-end flag, and the linked app user when we can match it.

## Connection health checks

A "Stripe connection" card that runs live checks and shows green/amber/red with a plain-language message:

- Live API key configured and accepting requests
- Webhook signing secret present
- Last webhook event received (timestamp; amber if nothing in 7 days)
- Elite price `elite_monthly` resolves in the current environment
- Local `subscriptions` table vs Stripe drift — count of Stripe subscriptions with no matching row (means webhooks are missing events)

Any red/amber item gets a one-line "what this means / what to do" note, same style as the existing credential health card.

## Technical notes

- New server functions in `src/lib/admin-billing.functions.ts`, admin-gated (same `useIsAdmin` / access-token pattern used by `admin.functions.ts` and `webhook-health.functions.ts`).
- Stripe reads go through `createStripeClient(env)` from `@/lib/stripe.server` — subscriptions list, invoices/charges list, prices lookup by `lookup_key`, and `webhookEndpoints`/event list for last-event time. All calls wrapped so a Stripe failure returns `{ error }` rather than a 500.
- Drift check joins Stripe subscription ids against the existing `subscriptions` table filtered by `environment`.
- New route `src/routes/dashboard.admin.billing.tsx` with its own `head()` meta; link added from the admin index and a summary tile linking to it from `dashboard.admin.health.tsx`.
- Read-only: no refunds, cancels, or writes from this page.
