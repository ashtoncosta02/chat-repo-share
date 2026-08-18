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
      { name: "twitter:card", content: "summary_large_image" },
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
