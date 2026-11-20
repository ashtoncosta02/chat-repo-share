/**
 * Decides which Meta event (if any) a finished Stripe checkout earns. Only a completed checkout that
 * belongs to the signed-in account counts. Nothing about leads, calls or the customer is included.
 */
export type CheckoutConversion =
  | { event: "StartTrial"; eventId: string; params: { content_name: string; currency: string } }
  | { event: "Purchase"; eventId: string; params: { content_name: string; value: number; currency: string } };

export interface CheckoutSessionFacts {
  id: string;
  status: string | null;
  mode: string | null;
  paymentStatus: string | null;
  ownerUserId: string | null;
  amountTotal: number | null;
  currency: string | null;
  subscriptionStatus: string | null;
  planLookupKey: string | null;
}

export function conversionFromCheckout(s: CheckoutSessionFacts, userId: string): CheckoutConversion | null {
  if (!s.id || s.status !== "complete" || s.ownerUserId !== userId) return null;
  const currency = (s.currency ?? "usd").toUpperCase();
  const content_name = s.planLookupKey ?? "subscription";
  if (s.mode === "subscription" && s.subscriptionStatus === "trialing") {
    return { event: "StartTrial", eventId: s.id, params: { content_name, currency } };
  }
  const paidSubscription = s.mode === "subscription" && s.subscriptionStatus === "active";
  if ((paidSubscription || s.mode === "payment") && s.paymentStatus === "paid" && (s.amountTotal ?? 0) > 0) {
    return {
      event: "Purchase",
      eventId: s.id,
      params: { content_name, value: Math.round(s.amountTotal ?? 0) / 100, currency },
    };
  }
  return null;
}
