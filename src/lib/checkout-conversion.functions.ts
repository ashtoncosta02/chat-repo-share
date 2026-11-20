import { createServerFn } from "@tanstack/react-start";
import type Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, type StripeEnv } from "@/lib/stripe.server";
import { conversionFromCheckout, type CheckoutConversion } from "@/lib/checkout-conversion";

/** Confirms with Stripe that the caller's own checkout finished, and says which Meta event it earns. */
export const getCheckoutConversion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string; environment: StripeEnv }) => {
    if (typeof data.sessionId !== "string" || !/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(data.sessionId)) {
      throw new Error("Invalid checkout session");
    }
    if (data.environment !== "sandbox" && data.environment !== "live") throw new Error("Invalid payment environment");
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutConversion | null> => {
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
        expand: ["subscription", "line_items.data.price"],
      });
      const subscription = session.subscription as Stripe.Subscription | string | null;
      const price = session.line_items?.data[0]?.price;
      return conversionFromCheckout(
        {
          id: session.id,
          status: session.status ?? null,
          mode: session.mode ?? null,
          paymentStatus: session.payment_status ?? null,
          ownerUserId: session.metadata?.["userId"] ?? null,
          amountTotal: session.amount_total ?? null,
          currency: session.currency ?? null,
          subscriptionStatus: subscription && typeof subscription === "object" ? subscription.status : null,
          planLookupKey: price?.lookup_key ?? null,
        },
        context.userId,
      );
    } catch {
      // Never block the dashboard; an unconfirmed checkout simply sends nothing to Meta.
      return null;
    }
  });
