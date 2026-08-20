import { createServerFn } from "@tanstack/react-start";
import type Stripe from "stripe";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type PortalSessionResult = { url: string } | { error: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      priceId: string;
      /** Ignored: the account is always taken from the authenticated session. */
      customerEmail?: string;
      userId?: string;
      returnUrl: string;
      environment: StripeEnv;
      /** When set, Stripe collects the card but charges $0 for this many days. */
      trialDays?: number;
    }) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
      if (data.trialDays !== undefined) {
        if (!Number.isInteger(data.trialDays) || data.trialDays < 1 || data.trialDays > 90) {
          throw new Error("Invalid trial length");
        }
      }
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      const stripe = createStripeClient(data.environment);

      // Never trust a client-supplied account: the checkout is always bound to
      // the authenticated caller.
      const userId = context.userId;
      const email =
        typeof context.claims?.email === "string" ? (context.claims.email as string) : undefined;

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];
      const isRecurring = stripePrice.type === "recurring";

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

      const withTrial = isRecurring && Boolean(data.trialDays);

      // Card-on-file free trial: Stripe stores the payment method now, charges
      // $0 today, and automatically bills at the end of the trial period.
      const subscriptionData = {
        metadata: { userId },
        ...(withTrial && { trial_period_days: data.trialDays }),
      };

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        ...(customerId && { customer: customerId }),
        // Stripe handles tax compliance, fraud, disputes and transaction support.
        managed_payments: { enabled: true },
        ...(withTrial && { payment_method_collection: "always" }),
        ...(data.userId && { metadata: { userId: data.userId, managed_payments: "true" } }),
        ...(isRecurring &&
          Object.keys(subscriptionData).length > 0 && { subscription_data: subscriptionData }),
      } as Stripe.Checkout.SessionCreateParams);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });


/** Opens the Stripe billing portal so the user can manage or cancel their plan. */
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    const { supabase, userId } = context;

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      return { error: "No subscription found for this account." };
    }

    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id as string,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
