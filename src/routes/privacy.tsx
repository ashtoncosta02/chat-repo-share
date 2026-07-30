import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Ask Janice" },
      {
        name: "description",
        content: "How Ask Janice collects, uses, and protects your data and your callers' data.",
      },
      { property: "og:title", content: "Privacy Policy — Ask Janice" },
      {
        property: "og:description",
        content: "How Ask Janice collects, uses, and protects your data.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
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
        <h1 className="font-display text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: June 10, 2026</p>

        <section className="mt-8 space-y-4 text-base leading-relaxed text-foreground/90">
          <h2 className="font-display text-2xl font-semibold">1. Who We Are</h2>
          <p>
            Ask Janice is the legal business name of the seller and operator of this service
            ("Ask Janice", "we", "us", "our"). Ask Janice provides an AI virtual receptionist
            service. You can reach us at{" "}
            <a href="mailto:hello@askjanice.net" className="text-gold hover:underline">
              hello@askjanice.net
            </a>
            . This policy covers (a) account data from our customers ("you") and (b) caller data
            from end users interacting with your AI receptionist.
          </p>
          <p>
            <strong>Our role:</strong> Ask Janice is the <strong>data controller</strong> for
            personal data relating to our customers and their accounts (for example, your name,
            email, business details, billing records and usage data). For caller and website
            visitor data processed by your AI receptionist, Ask Janice acts as a{" "}
            <strong>data processor</strong> on your behalf, and you are the controller of that
            data.
          </p>

          <h2 className="font-display text-2xl font-semibold">2. What We Collect</h2>
          <p><strong>From customers:</strong> name, email, business name, business details and FAQs you provide, payment information (processed by Paddle), and usage activity.</p>
          <p><strong>From callers / website visitors:</strong> phone number, name, email when provided, call audio recordings, transcripts, chat messages, IP address, and any information they share with the AI.</p>

          <h2 className="font-display text-2xl font-semibold">3. How We Use Data</h2>
          <ul className="list-disc pl-6">
            <li>Operate the AI receptionist (answer calls, transcribe, capture leads, book appointments).</li>
            <li>Display leads and transcripts in your dashboard.</li>
            <li>Send SMS follow-ups when you enable them.</li>
            <li>Improve the Service (debugging, abuse prevention). We do not train third-party foundation models on your data.</li>
            <li>Send service-related emails. We do not sell personal data.</li>
          </ul>

          <h2 className="font-display text-2xl font-semibold">4. Call Recording</h2>
          <p>
            Calls are recorded and transcribed. The default greeting discloses recording. You are
            responsible for ensuring the greeting complies with the call-recording laws of every
            state in which your callers are located, including two-party-consent jurisdictions.
          </p>

          <h2 className="font-display text-2xl font-semibold">5. Legal Basis for Processing</h2>
          <p>
            Where the GDPR, UK GDPR or similar laws apply, we rely on the following legal bases
            (Art. 6 GDPR):
          </p>
          <ul className="list-disc pl-6">
            <li><strong>Performance of a contract</strong> — creating and managing your account, providing the AI receptionist, processing your subscription and providing support.</li>
            <li><strong>Legitimate interests</strong> — securing the Service, preventing fraud and abuse, debugging and improving our product, and basic service analytics.</li>
            <li><strong>Legal obligation</strong> — tax, accounting, and responding to lawful requests from authorities.</li>
            <li><strong>Consent</strong> — optional marketing communications, non-essential cookies, and any optional integrations you choose to connect. You may withdraw consent at any time.</li>
          </ul>
          <p>
            For caller and visitor data processed on your behalf, you are responsible for
            establishing the appropriate legal basis (including call-recording consent).
          </p>

          <h2 className="font-display text-2xl font-semibold">6. Data Sharing</h2>
          <p>We share data only with the sub-processors required to run the Service:</p>
          <ul className="list-disc pl-6">
            <li><strong>Twilio</strong> — phone numbers, SMS, call audio transport.</li>
            <li><strong>ElevenLabs</strong> — AI voice generation and conversation.</li>
            <li><strong>Google</strong> — Calendar integration and (optional) OAuth sign-in.</li>
            <li><strong>Lovable Cloud / Supabase</strong> — database, authentication, storage.</li>
            <li><strong>Paddle</strong> — payment processing, subscription management, tax compliance, and invoicing (when billing is enabled).</li>
          </ul>
          <p>We disclose data when required by law or to protect our rights.</p>

          <h2 className="font-display text-2xl font-semibold">6. Data Retention</h2>
          <p>
            Account data is retained while your account is active. Non-lead conversations may be
            auto-deleted on a schedule you configure (24 hours or 1 week). Lead and booking
            records are retained until you delete them or close your account.
          </p>

          <h2 className="font-display text-2xl font-semibold">7. Your Rights</h2>
          <p>
            Depending on your location (GDPR, CCPA, etc.), you may have rights to access, correct,
            delete, or export your data. Email{" "}
            <a href="mailto:hello@askjanice.net" className="text-gold hover:underline">
              hello@askjanice.net
            </a>{" "}
            to exercise them. End-user callers should direct requests to the business they called;
            we act as a processor on the business's behalf.
          </p>

          <h2 className="font-display text-2xl font-semibold">8. Security</h2>
          <p>
            We use industry-standard measures including TLS in transit, encryption at rest,
            row-level security in the database, and least-privilege access controls. No system is
            perfectly secure; you use the Service at your own risk.
          </p>

          <h2 className="font-display text-2xl font-semibold">9. Children</h2>
          <p>The Service is not intended for users under 18.</p>

          <h2 className="font-display text-2xl font-semibold">10. Changes</h2>
          <p>
            We will post updates here and update the "Last updated" date. Material changes will be
            announced via email or in-app notice.
          </p>

          <h2 className="font-display text-2xl font-semibold">11. Contact</h2>
          <p>
            Email{" "}
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
