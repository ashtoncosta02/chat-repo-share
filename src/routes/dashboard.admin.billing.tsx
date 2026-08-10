import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { getAdminBillingSnapshot } from "@/lib/admin-billing.functions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  ArrowLeft,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCcw,
  ExternalLink,
  Shield,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/admin/billing")({
  head: () => ({
    meta: [
      { title: "Admin · Billing health — Ask Janice" },
      { name: "description", content: "Stripe revenue KPIs, transactions and connection health for Ask Janice." },
    ],
  }),
  component: AdminBillingPage,
});

type Snapshot = Awaited<ReturnType<typeof getAdminBillingSnapshot>>;
type Env = "sandbox" | "live";
type TxFilter = "all" | "paid" | "failed" | "refunded";

const money = (n: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: (currency || "usd").toUpperCase() }).format(n);

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

function AdminBillingPage() {
  const { session } = useAuth();
  const { isAdmin, checked } = useIsAdmin();
  const navigate = useNavigate();
  const [env, setEnv] = useState<Env>("live");
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TxFilter>("all");

  useEffect(() => {
    if (checked && !isAdmin) navigate({ to: "/dashboard" });
  }, [checked, isAdmin, navigate]);

  const load = useCallback(() => {
    if (!isAdmin || !session?.access_token) return;
    setLoading(true);
    getAdminBillingSnapshot({ data: { accessToken: session.access_token, environment: env } })
      .then(setData)
      .finally(() => setLoading(false));
  }, [isAdmin, session?.access_token, env]);

  useEffect(() => {
    load();
  }, [load]);

  if (!checked || !isAdmin) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const snap = data && data.ok ? data : null;
  const errorMsg = data && !data.ok ? data.error : null;
  const k = snap?.kpis;
  const transactions = (snap?.transactions ?? []).filter((t) => filter === "all" || t.status === filter);

  return (
    <div className="min-h-full">
      <PageHeader
        title="Billing health"
        description="Revenue, transactions and Stripe connection status across all accounts."
        breadcrumb={
          <span className="inline-flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Admin
          </span>
        }
      />

      <div className="px-4 sm:px-8 py-6 space-y-6 max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/dashboard/admin"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to admin
          </Link>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
              {(["live", "sandbox"] as Env[]).map((e) => (
                <button
                  key={e}
                  onClick={() => setEnv(e)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    env === e ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {e === "live" ? "Live" : "Test"}
                </button>
              ))}
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <div className="font-medium">Couldn’t reach Stripe in {env === "live" ? "live" : "test"} mode</div>
            <div className="mt-1">{errorMsg}</div>
            <div className="mt-1 text-red-700/80">
              If this is live mode, payment go-live may not be finished yet — live keys are provisioned at the end of that flow.
            </div>
          </div>
        )}

        {loading && !snap && <div className="text-muted-foreground text-sm">Loading Stripe data…</div>}

        {snap && k && (
          <>
            {/* KPIs */}
            <section>
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <CreditCard className="h-3.5 w-3.5" /> Revenue
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="MRR" value={money(k.mrr, k.currency)} sub={`${k.active + k.trialing} paying/trialing`} />
                <Stat label="Active subscribers" value={k.active} sub={`${k.totalSubscriptions} total records`} />
                <Stat label="Trialing" value={k.trialing} sub="Converting soon" />
                <Stat
                  label="Past due / unpaid"
                  value={k.pastDue}
                  sub={k.pastDue > 0 ? "Revenue at risk" : "All current"}
                  tone={k.pastDue > 0 ? "bad" : "good"}
                />
                <Stat label="Revenue (30d)" value={money(k.revenue30d, k.currency)} sub="Net of refunds" />
                <Stat label="Refunded (30d)" value={money(k.refunded30d, k.currency)} />
                <Stat
                  label="Failed payments (7d)"
                  value={k.failed7d}
                  sub={k.failed7d > 0 ? "Check card declines" : "None"}
                  tone={k.failed7d > 0 ? "bad" : "good"}
                />
                <Stat label="Canceled this month" value={k.canceledThisMonth} sub="Churn" />
              </div>
            </section>

            {/* Connection health */}
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-sm font-medium">Stripe connection</h2>
                <StatusPill status={snap.overall} />
              </div>
              <div className="space-y-3">
                {snap.checks.map((c) => (
                  <div key={c.id} className="flex items-start gap-3">
                    <StatusIcon status={c.status} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{c.label}</div>
                      <div className="text-xs text-muted-foreground break-words">{c.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Transactions */}
            <section className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
                <h2 className="text-sm font-medium">Recent transactions (30 days)</h2>
                <div className="inline-flex rounded-lg border border-border p-0.5">
                  {(["all", "paid", "failed", "refunded"] as TxFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`rounded-md px-2.5 py-1 text-xs capitalize ${
                        filter === f ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              {transactions.length === 0 ? (
                <div className="px-5 pb-5 text-sm text-muted-foreground">No transactions to show.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                      <tr className="border-y border-border bg-muted/40">
                        <th className="px-5 py-2 text-left font-medium">Date</th>
                        <th className="px-3 py-2 text-left font-medium">Customer</th>
                        <th className="px-3 py-2 text-left font-medium">Description</th>
                        <th className="px-3 py-2 text-right font-medium">Amount</th>
                        <th className="px-3 py-2 text-left font-medium">Status</th>
                        <th className="px-5 py-2 text-right font-medium">Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t) => (
                        <tr key={t.id} className="border-b border-border last:border-0">
                          <td className="px-5 py-2.5 whitespace-nowrap text-muted-foreground">{when(t.created)}</td>
                          <td className="px-3 py-2.5">{t.email ?? "—"}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {t.description ?? "—"}
                            {t.failureMessage && <div className="text-xs text-red-600">{t.failureMessage}</div>}
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">{money(t.amount, t.currency)}</td>
                          <td className="px-3 py-2.5">
                            <TxBadge status={t.status} />
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            {t.receiptUrl ? (
                              <a
                                href={t.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[var(--gold)] hover:underline"
                              >
                                View <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Subscriptions */}
            <section className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-5 pb-3">
                <h2 className="text-sm font-medium">Subscriptions</h2>
              </div>
              {snap.subscriptions.length === 0 ? (
                <div className="px-5 pb-5 text-sm text-muted-foreground">No subscriptions in this environment yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                      <tr className="border-y border-border bg-muted/40">
                        <th className="px-5 py-2 text-left font-medium">Customer</th>
                        <th className="px-3 py-2 text-left font-medium">Plan</th>
                        <th className="px-3 py-2 text-right font-medium">Monthly</th>
                        <th className="px-3 py-2 text-left font-medium">Status</th>
                        <th className="px-3 py-2 text-left font-medium">Renews</th>
                        <th className="px-5 py-2 text-left font-medium">In app</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snap.subscriptions.map((s) => (
                        <tr key={s.id} className="border-b border-border last:border-0">
                          <td className="px-5 py-2.5">{s.email ?? "—"}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{s.plan ?? "—"}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">{money(s.amount, s.currency)}</td>
                          <td className="px-3 py-2.5">
                            <TxBadge status={s.status} />
                            {s.cancelAtPeriodEnd && (
                              <div className="text-xs text-amber-600">Cancels at period end</div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                            {when(s.currentPeriodEnd)}
                          </td>
                          <td className="px-5 py-2.5">
                            {s.inDatabase ? (
                              <span className="text-xs text-emerald-700">Synced</span>
                            ) : (
                              <span className="text-xs text-amber-700">Missing</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div
        className={`font-display text-2xl font-semibold mt-1 ${
          tone === "bad" ? "text-red-600" : ""
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function StatusIcon({ status }: { status: "ok" | "warn" | "fail" }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />;
  return <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />;
}

function StatusPill({ status }: { status: "ok" | "warn" | "fail" }) {
  const map = {
    ok: { text: "All good", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    warn: { text: "Needs attention", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    fail: { text: "Problem", cls: "bg-red-50 text-red-700 border-red-200" },
  } as const;
  const s = map[status];
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${s.cls}`}>{s.text}</span>;
}

function TxBadge({ status }: { status: string }) {
  const cls =
    status === "paid" || status === "active"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "failed" || status === "past_due" || status === "unpaid"
        ? "bg-red-50 text-red-700 border-red-200"
        : status === "refunded" || status === "trialing"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-muted text-muted-foreground border-border";
  return <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${cls}`}>{status.replace("_", " ")}</span>;
}
