import { useEffect, type ReactNode } from "react";
import { Nav } from "@/janice/components/Nav";
import { Footer } from "@/janice/components/Footer";
import { HeroScroll } from "@/janice/components/hero/HeroScroll";
import { CallSection } from "@/janice/components/sections/CallSection";
import { HowSection } from "@/janice/components/sections/HowSection";
import { ChatSection } from "@/janice/components/sections/ChatSection";
import { InboxSection } from "@/janice/components/sections/InboxSection";
import { FeaturesSection } from "@/janice/components/sections/FeaturesSection";
import { AudienceSection } from "@/janice/components/sections/AudienceSection";
import { PricingSection } from "@/janice/components/sections/PricingSection";
import { FaqSection } from "@/janice/components/sections/FaqSection";
import { ClosingSection } from "@/janice/components/sections/ClosingSection";

/**
 * The askjanice.net marketing page: pinned 3D scroll hero (calls become the logo) and the sections below.
 * Browser-only work (three.js, Lenis, canvases) starts in effects, so this renders safely on the server.
 */
export function JaniceLanding({ banner }: { banner?: ReactNode }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let lenis: { destroy: () => void } | null = null;
    let cancelled = false;
    import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      lenis = new Lenis({ autoRaf: true, anchors: { offset: -72 }, lerp: 0.11 });
    });
    return () => {
      cancelled = true;
      lenis?.destroy();
    };
  }, []);

  return (
    <div className="aj-landing min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-aj-paper focus:px-4 focus:py-2 focus:text-aj-ink focus:shadow-[var(--shadow-aj-lift)]"
      >
        Skip to content
      </a>
      <Nav banner={banner} />
      <main id="main">
        <HeroScroll />
        <CallSection />
        <HowSection />
        <ChatSection />
        <InboxSection />
        <FeaturesSection />
        <AudienceSection />
        <PricingSection />
        <FaqSection />
        <ClosingSection />
      </main>
      <Footer />
    </div>
  );
}
