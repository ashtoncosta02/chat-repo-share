import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { JanicePlansLanding } from "@/components/landing/JanicePlansLanding";

const OG_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/bdf233e4-c52b-4b09-802c-6f9c4dad8519/id-preview-970c1d47--d1e796ad-671c-47e1-843b-cdecc02fe11f.lovable.app-1782442129187.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ask Janice — The AI Receptionist That Never Sleeps" },
      {
        name: "description",
        content:
          "Janice answers your business calls 24/7, captures every lead, and books appointments into your calendar. Essential $79/month or Elite $139/month, with a 7-day free trial.",
      },
      { property: "og:title", content: "Ask Janice — The AI Receptionist That Never Sleeps" },
      {
        property: "og:description",
        content:
          "Answers your calls 24/7, captures leads, and books appointments straight into your calendar. Essential $79/month · Elite $139/month · No contracts.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://askjanice.net/" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard/conversations", replace: true });
  }, [user, loading, navigate]);
  return <JanicePlansLanding banner={<PaymentTestModeBanner />} />;
}
