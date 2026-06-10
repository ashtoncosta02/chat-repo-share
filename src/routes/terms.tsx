import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Ask Janice" },
      {
        name: "description",
        content: "Terms of Service for Ask Janice — AI voice receptionist for small businesses.",
      },
      { property: "og:title", content: "Terms of Service — Ask Janice" },
      {
        property: "og:description",
        content: "Terms of Service for Ask Janice.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
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
      <main className="mx-auto max-w-3xl px-6 py-12 prose prose-invert prose-headings:font-display">
        <h1 className="font-display text-4xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: June 10, 2026</p>

        <section className="mt-8 space-y-4 text-base leading-relaxed text-foreground/90">
          <h2 className="font-display text-2xl font-semibold">1. Acceptance of Terms</h2>
          <p>
            By creating an account or using Ask Janice ("Service"), you agree to these Terms of
            Service. If you do not agree, do not use the Service. The Service is provided by
            Ask Janice ("we", "us", "our"). Contact: ashtoncosta02@gmail.com.
          </p>

          <h2 className="font-display text-2xl font-semibold">2. Description of Service</h2>
          <p>
            Ask Janice provides an AI-powered virtual receptionist that answers phone calls, chats
            with website visitors, captures leads, and books appointments on your behalf.
          </p>

          <h2 className="font-display text-2xl font-semibold">3. Your Account</h2>
          <p>
            You must be at least 18 years old and operate a legitimate business. You are
            responsible for keeping your credentials confidential and for all activity on your
            account. You must provide accurate information about your business so the AI can
            represent it correctly.
          </p>

          <h2 className="font-display text-2xl font-semibold">4. Call Recording &amp; Consent</h2>
          <p>
            The Service records and transcribes calls. The default greeting includes a recording
            disclosure. You are responsible for complying with all applicable call-recording laws
            in your jurisdiction, including two-party-consent laws in states like California,
            Florida, and Illinois. You must not disable the recording disclosure where required by
            law.
          </p>

          <h2 className="font-display text-2xl font-semibold">5. Acceptable Use</h2>
          <p>You agree not to use the Service to:</p>
          <ul className="list-disc pl-6">
            <li>Place or facilitate unsolicited automated calls or texts (robocalls/spam) in violation of the TCPA, CAN-SPAM, or similar laws.</li>
            <li>Impersonate another business or person.</li>
            <li>Collect sensitive personal data (medical, financial, government ID) through the AI.</li>
            <li>Conduct illegal activity, harassment, fraud, or hate speech.</li>
            <li>Reverse-engineer, scrape, or resell the Service.</li>
          </ul>
          <p>We may suspend or terminate accounts that violate these rules.</p>

          <h2 className="font-display text-2xl font-semibold">6. Subscription &amp; Billing</h2>
          <p>
            Paid plans are billed monthly in advance. Subscriptions auto-renew until cancelled. You
            may cancel anytime from your dashboard; cancellation takes effect at the end of the
            current billing period. A 30-day money-back guarantee applies to your first month only.
            Phone-number, SMS, and AI-usage fees from underlying providers are included in your
            plan unless stated otherwise.
          </p>

          <h2 className="font-display text-2xl font-semibold">7. Third-Party Services</h2>
          <p>
            The Service relies on third parties including Twilio (telephony), ElevenLabs (voice
            AI), Google (calendar &amp; auth), and Lovable Cloud (hosting). Their terms apply to
            their portions of the Service. Outages or changes by those providers may affect
            availability.
          </p>

          <h2 className="font-display text-2xl font-semibold">8. Service Availability</h2>
          <p>
            We aim for high uptime but provide the Service "as is" without warranty of
            uninterrupted operation. We may modify or discontinue features with notice.
          </p>

          <h2 className="font-display text-2xl font-semibold">9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, our total liability for any claim relating to
            the Service is limited to the amount you paid us in the 3 months before the claim. We
            are not liable for lost profits, lost business, or indirect damages.
          </p>

          <h2 className="font-display text-2xl font-semibold">10. Termination</h2>
          <p>
            You may close your account anytime. We may suspend or terminate accounts for breach of
            these Terms or unlawful use. Upon termination, we may delete your data after a
            reasonable retention period.
          </p>

          <h2 className="font-display text-2xl font-semibold">11. Changes</h2>
          <p>
            We may update these Terms. Material changes will be announced via email or in-app
            notice. Continued use after the effective date constitutes acceptance.
          </p>

          <h2 className="font-display text-2xl font-semibold">12. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the United States and the state in which Ask
            Janice operates, without regard to conflict-of-laws principles.
          </p>

          <h2 className="font-display text-2xl font-semibold">13. Contact</h2>
          <p>
            Questions? Email{" "}
            <a href="mailto:ashtoncosta02@gmail.com" className="text-gold hover:underline">
              ashtoncosta02@gmail.com
            </a>
            .
          </p>
        </section>
      </main>
      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto max-w-3xl px-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Ask Janice ·{" "}
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link> ·{" "}
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
