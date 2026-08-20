import { createFileRoute } from "@tanstack/react-router";

import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { Hero } from "@/components/landing/Hero";
import { StatBand } from "@/components/landing/StatBand";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Showcase } from "@/components/landing/Showcase";
import { Features } from "@/components/landing/Features";
import { UseCases } from "@/components/landing/UseCases";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { CTABand } from "@/components/landing/CTABand";
import { SiteFooter } from "@/components/landing/SiteFooter";

const OG_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/bdf233e4-c52b-4b09-802c-6f9c4dad8519/id-preview-970c1d47--d1e796ad-671c-47e1-843b-cdecc02fe11f.lovable.app-1782442129187.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ask Janice — The AI Receptionist That Never Sleeps" },
      {
        name: "description",
        content:
          "Janice answers your business calls 24/7, captures every lead, and books appointments into your calendar. Unlimited calls, $97/mo, setup in minutes.",
      },
      { property: "og:title", content: "Ask Janice — The AI Receptionist That Never Sleeps" },
      {
        property: "og:description",
        content:
          "Answers your calls 24/7, captures leads, and books appointments straight into your calendar. Unlimited calls · $97/mo · No contracts.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://askjanice.net/" },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: "https://askjanice.net/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Ask Janice",
          url: "https://askjanice.net/",
          logo: "https://askjanice.net/__l5e/assets-v1/568beb77-a6b4-4141-8878-452f170a1f2f/favicon.png",
          email: "hello@askjanice.net",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Ask Janice",
          url: "https://askjanice.net/",
        }),
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PaymentTestModeBanner />
      <SiteHeader />
      <main>
        <Hero />
        <StatBand />
        <HowItWorks />
        <Showcase />
        <Features />
        <UseCases />
        <PricingSection />
        <FAQSection />
        <CTABand />
      </main>
      <SiteFooter />
    </div>
  );
}
