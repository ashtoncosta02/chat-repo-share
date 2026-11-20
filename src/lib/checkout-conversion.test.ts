import { describe, expect, it } from "vitest";
import { conversionFromCheckout, type CheckoutSessionFacts } from "./checkout-conversion";

const base: CheckoutSessionFacts = {
  id: "cs_test_abc123",
  status: "complete",
  mode: "subscription",
  paymentStatus: "no_payment_required",
  ownerUserId: "user-1",
  amountTotal: 0,
  currency: "usd",
  subscriptionStatus: "trialing",
  planLookupKey: "essential_monthly",
};

describe("Meta checkout conversions", () => {
  it("a completed free-trial checkout is a StartTrial with no money value", () => {
    expect(conversionFromCheckout(base, "user-1")).toEqual({
      event: "StartTrial",
      eventId: "cs_test_abc123",
      params: { content_name: "essential_monthly", currency: "USD" },
    });
  });

  it("a paid Elite checkout is a Purchase with the real amount and currency", () => {
    const paid = { ...base, paymentStatus: "paid", amountTotal: 13900, subscriptionStatus: "active", planLookupKey: "elite_monthly" };
    expect(conversionFromCheckout(paid, "user-1")).toEqual({
      event: "Purchase",
      eventId: "cs_test_abc123",
      params: { content_name: "elite_monthly", value: 139, currency: "USD" },
    });
  });

  it("an unpaid or unfinished checkout sends nothing", () => {
    expect(conversionFromCheckout({ ...base, status: "open" }, "user-1")).toBeNull();
    expect(conversionFromCheckout({ ...base, subscriptionStatus: "active", paymentStatus: "unpaid", amountTotal: 7900 }, "user-1")).toBeNull();
    expect(conversionFromCheckout({ ...base, subscriptionStatus: "incomplete" }, "user-1")).toBeNull();
  });

  it("another account's checkout sends nothing", () => {
    expect(conversionFromCheckout(base, "user-2")).toBeNull();
  });
});
