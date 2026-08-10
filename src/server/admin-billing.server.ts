import type Stripe from "stripe";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga",
  "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);
const THREE_DECIMAL = new Set(["bhd", "jod", "kwd", "omr", "tnd"]);

export function toMajorUnit(amount: number | null | undefined, currency: string): number {
  const value = amount ?? 0;
  const c = (currency ?? "usd").toLowerCase();
  if (ZERO_DECIMAL.has(c)) return value;
  if (THREE_DECIMAL.has(c)) return value / 1000;
  return value / 100;
}

const iso = (unix?: number | null) => (unix ? new Date(unix * 1000).toISOString() : null);

function planFromPrice(price: Stripe.Price | null | undefined): string | null {
  if (!price) return null;
  return price.lookup_key ?? price.metadata?.["lovable_external_id"] ?? price.id ?? null;
}

/** Monthly-equivalent amount (major units) for a recurring price. */
function monthlyAmount(price: Stripe.Price | null | undefined, quantity: number): number {
  if (!price?.unit_amount || !price.recurring) return 0;
  const per = toMajorUnit(price.unit_amount, price.currency) * quantity;
  const { interval, interval_count } = price.recurring;
  const months =
    interval === "year"
      ? 12 * (interval_count || 1)
      : interval === "month"
        ? interval_count || 1
        : interval === "week"
          ? (interval_count || 1) / 4.345
          : (interval_count || 1) / 30.44;
  return months > 0 ? per / months : 0;
}

export type BillingSnapshot = Awaited<ReturnType<typeof getBillingSnapshot>>;

export async function getBillingSnapshot(env: StripeEnv) {
  try {
    const stripe = createStripeClient(env);
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 86400;
    const sevenDaysAgo = now - 7 * 86400;
    const startOfMonth = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);

    const [subsRes, chargesRes, eliteRes, eventsRes, endpointsRes] = await Promise.allSettled([
      stripe.subscriptions.list({ status: "all", limit: 100, expand: ["data.customer"] }),
      stripe.charges.list({ limit: 50, created: { gte: thirtyDaysAgo } }),
      stripe.prices.list({ lookup_keys: ["elite_monthly"], limit: 1 }),
      stripe.events.list({ limit: 1 }),
      stripe.webhookEndpoints.list({ limit: 20 }),
    ]);

    if (subsRes.status === "rejected") {
      return { ok: false as const, error: getStripeErrorMessage(subsRes.reason) };
    }

    const subs = subsRes.value.data;
    const charges = chargesRes.status === "fulfilled" ? chargesRes.value.data : [];

    // ---- KPIs ------------------------------------------------------------
    let mrr = 0;
    let currency = "usd";
    let active = 0;
    let trialing = 0;
    let pastDue = 0;
    let canceledThisMonth = 0;

    for (const sub of subs) {
      const item = sub.items?.data?.[0];
      const price = item?.price ?? null;
      if (price?.currency) currency = price.currency;
      if (sub.status === "active" || sub.status === "trialing") {
        if (sub.status === "active") active += 1;
        else trialing += 1;
        mrr += monthlyAmount(price, item?.quantity ?? 1);
      }
      if (sub.status === "past_due" || sub.status === "unpaid") pastDue += 1;
      if (sub.canceled_at && sub.canceled_at >= startOfMonth) canceledThisMonth += 1;
    }

    const paidCharges = charges.filter((c) => c.paid && c.status === "succeeded");
    const revenue30d = paidCharges.reduce(
      (sum, c) => sum + toMajorUnit(c.amount - (c.amount_refunded ?? 0), c.currency),
      0,
    );
    const failed7d = charges.filter((c) => c.status === "failed" && c.created >= sevenDaysAgo).length;
    const refunded30d = charges.reduce((sum, c) => sum + toMajorUnit(c.amount_refunded ?? 0, c.currency), 0);

    // ---- Transactions ----------------------------------------------------
    const transactions = charges.map((c) => ({
      id: c.id,
      created: iso(c.created),
      email: c.billing_details?.email ?? c.receipt_email ?? null,
      amount: toMajorUnit(c.amount, c.currency),
      refunded: toMajorUnit(c.amount_refunded ?? 0, c.currency),
      currency: c.currency,
      status: c.refunded
        ? "refunded"
        : c.status === "succeeded"
          ? "paid"
          : c.status === "failed"
            ? "failed"
            : "pending",
      description: c.description ?? null,
      failureMessage: c.failure_message ?? null,
      receiptUrl: c.receipt_url ?? null,
    }));

    // ---- Subscriptions list + drift -------------------------------------
    const { data: localRows } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_subscription_id, user_id")
      .eq("environment", env);
    const localMap = new Map((localRows ?? []).map((r) => [r.stripe_subscription_id as string, r.user_id as string]));

    const userIds = [...new Set([...localMap.values()])];
    const emailByUser = new Map<string, string>();
    if (userIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, email")
        .in("user_id", userIds);
      for (const p of profiles ?? []) emailByUser.set(p.user_id as string, (p.email as string) ?? "");
    }

    const subscriptions = subs.map((sub) => {
      const item = sub.items?.data?.[0];
      const cust = sub.customer;
      const localUser = localMap.get(sub.id) ?? null;
      return {
        id: sub.id,
        status: sub.status,
        plan: planFromPrice(item?.price),
        email:
          (typeof cust === "object" && cust && !("deleted" in cust && cust.deleted) ? cust.email : null) ??
          (localUser ? (emailByUser.get(localUser) ?? null) : null),
        amount: monthlyAmount(item?.price, item?.quantity ?? 1),
        currency: item?.price?.currency ?? currency,
        currentPeriodEnd: iso(item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end),
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        linkedUserId: localUser,
        inDatabase: localMap.has(sub.id),
      };
    });

    const driftCount = subscriptions.filter(
      (s) => !s.inDatabase && ["active", "trialing", "past_due"].includes(s.status),
    ).length;

    // ---- Connection health ----------------------------------------------
    const checks: Array<{ id: string; label: string; status: "ok" | "warn" | "fail"; detail: string }> = [];

    checks.push({
      id: "api",
      label: `Stripe API (${env === "live" ? "live" : "test"})`,
      status: "ok",
      detail: "Connected — Stripe accepted our request.",
    });

    const webhookSecret = env === "live"
      ? process.env["PAYMENTS_LIVE_WEBHOOK_SECRET"]
      : process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"];
    checks.push({
      id: "webhook_secret",
      label: "Webhook signing secret",
      status: webhookSecret ? "ok" : "fail",
      detail: webhookSecret
        ? "Present — incoming payment events can be verified."
        : "Missing — subscription updates from Stripe will be rejected. Finish payment go-live so the secret is provisioned.",
    });

    const endpoints = endpointsRes.status === "fulfilled" ? endpointsRes.value.data : [];
    const appEndpoint = endpoints.find((e) => e.url?.includes("/api/public/payments/webhook"));
    checks.push({
      id: "webhook_endpoint",
      label: "App webhook endpoint",
      status: appEndpoint ? (appEndpoint.status === "enabled" ? "ok" : "warn") : "fail",
      detail: appEndpoint
        ? `${appEndpoint.status === "enabled" ? "Enabled" : "Disabled"} — ${appEndpoint.url}`
        : "Not registered with Stripe. Subscriptions will not sync into the app.",
    });

    const lastEvent = eventsRes.status === "fulfilled" ? eventsRes.value.data[0] : null;
    const lastEventAgeDays = lastEvent ? (now - lastEvent.created) / 86400 : null;
    checks.push({
      id: "last_event",
      label: "Last Stripe event",
      status: lastEvent == null ? "warn" : lastEventAgeDays! > 7 ? "warn" : "ok",
      detail: lastEvent
        ? `${lastEvent.type} — ${new Date(lastEvent.created * 1000).toLocaleString()}`
        : "No events seen yet. Normal if nobody has checked out in this environment.",
    });

    const elitePrice = eliteRes.status === "fulfilled" ? eliteRes.value.data[0] : null;
    checks.push({
      id: "price",
      label: "Elite plan price",
      status: elitePrice ? "ok" : "fail",
      detail: elitePrice
        ? `elite_monthly → ${toMajorUnit(elitePrice.unit_amount, elitePrice.currency).toFixed(2)} ${elitePrice.currency.toUpperCase()} / ${elitePrice.recurring?.interval ?? "one-time"}`
        : "Not found in this environment — checkout will fail with “Price not found”.",
    });

    checks.push({
      id: "drift",
      label: "Stripe ↔ app sync",
      status: driftCount === 0 ? "ok" : "warn",
      detail:
        driftCount === 0
          ? "Every live Stripe subscription has a matching record in the app."
          : `${driftCount} Stripe subscription${driftCount === 1 ? "" : "s"} missing from the app database — webhooks may have been dropped.`,
    });

    const overall: "ok" | "warn" | "fail" = checks.some((c) => c.status === "fail")
      ? "fail"
      : checks.some((c) => c.status === "warn")
        ? "warn"
        : "ok";

    return {
      ok: true as const,
      env,
      overall,
      kpis: {
        mrr,
        currency,
        active,
        trialing,
        pastDue,
        canceledThisMonth,
        revenue30d,
        refunded30d,
        failed7d,
        totalSubscriptions: subs.length,
      },
      checks,
      transactions,
      subscriptions,
    };
  } catch (error) {
    return { ok: false as const, error: getStripeErrorMessage(error) };
  }
}
