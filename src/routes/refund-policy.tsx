import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Refund Policy — Ask Janice" },
      {
        name: "description",
        content: "Ask Janice refund policy and money-back guarantee.",
      },
      { property: "og:title", content: "Refund Policy — Ask Janice" },
      {
        property: "og:description",
        content: "Ask Janice refund policy and money-back guarantee.",
      },
    ],
  }),
  component: RefundPolicyPage,
});

function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link to="/" className="font-display text-2xl font-bold tracking-tight">
            Ask <span className="text-gold">Janice</span>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-4xl font-bold tracking-tight">Refund Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: July 29, 2026</p>

        <section className="mt-8 space-y-4 text-base leading-relaxed text-foreground/90">
          <p>
            This Refund Policy applies to purchases of the Ask Janice service, sold by{" "}
            <strong>Ask Janice</strong>. We want you to be happy with your AI receptionist. If
            you're not satisfied with your first month, we offer a 30-day money-back guarantee.
          </p>

          <h2 className="font-display text-2xl font-semibold">Refund eligibility</h2>
          <p>
            You may request a full refund within 30 days of your first paid subscription charge.
            Refunds apply to your first month only. Usage beyond the first billing period is handled
            through cancellation at the end of the current billing cycle.
          </p>

          <h2 className="font-display text-2xl font-semibold">How to request a refund</h2>
          <p>
            Refunds are processed by our payment provider, Paddle. You can request a refund by
            visiting{" "}
            <a
              href="https://paddle.net"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline"
            >
              paddle.net
            </a>{" "}
            or by emailing us at{" "}
            <a href="mailto:hello@askjanice.net" className="text-gold hover:underline">
              hello@askjanice.net
            </a>
            . We aim to process refund requests within 3-5 business days.
          </p>

          <h2 className="font-display text-2xl font-semibold">Cancellation</h2>
          <p>
            You can cancel your subscription anytime from your Ask Janice account dashboard.
            Cancellation takes effect at the end of your current billing period, and you will retain
            access until that date.
          </p>

          <h2 className="font-display text-2xl font-semibold">Contact</h2>
          <p>
            Questions about refunds or billing? Email{" "}
            <a href="mailto:hello@askjanice.net" className="text-gold hover:underline">
              hello@askjanice.net
            </a>
            .
          </p>
        </section>
      </main>
      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto max-w-3xl px-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Ask Janice ·{" "}
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link> ·{" "}
          <Link to="/terms" className="hover:text-foreground">Terms</Link> ·{" "}
          <Link to="/refund-policy" className="hover:text-foreground">Refunds</Link>
        </div>
      </footer>
    </div>
  );
}
