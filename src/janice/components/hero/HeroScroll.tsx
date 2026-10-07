import { useEffect, useRef } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { JaniceMark } from "@/janice/components/Logo";
import { SIGNUP_HREF } from "@/janice/lib/site";
import { T, clamp01, easeInOut, lerp, seg, smooth, windowed } from "@/janice/three/timeline";
import type { JaniceScene, LogoRect } from "@/janice/three/JaniceScene";

const CAPTIONS = [
  {
    title: "Calls come in 24/7.",
    body: "Mid-job, after hours, on a Sunday. Every ring is a customer ready to book.",
  },
  {
    title: "Janice answers in under 2 seconds.",
    body: "Every call, in a natural voice trained on your services, hours and pricing.",
  },
  {
    title: "Every caller becomes a lead.",
    body: "Each call transcribed and saved, with the appointment already on your calendar.",
  },
];

const OVERLAY_BASE = 256;

/**
 * Pinned scroll scene: glossy "calls" ring, swirl in, merge into one violet core, press into the
 * coin and raise the white "j". The WebGL coin then hands over to the exact vector mark, which
 * flies into the nav. All per-frame work happens in one rAF loop that writes styles directly.
 */
export function HeroScroll() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const capRefs = useRef<(HTMLDivElement | null)[]>([]);
  const meetRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current!;
    const canvas = canvasRef.current!;
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const navMark = () => document.getElementById("aj-nav-mark");
    let scene: JaniceScene | null = null;
    let raf = 0;
    let disposed = false;
    let lastP = -1;
    const stills: number[] = [];
    let rect: LogoRect = { x: 0, y: 0, r: 0 };
    let target: DOMRect | null = null;
    const measureTarget = () => {
      const m = navMark();
      if (!m) return;
      const prev = m.style.opacity;
      target = m.getBoundingClientRect();
      m.style.opacity = prev;
    };
    const t0 = performance.now();

    const setDocked = (docked: boolean) => {
      const m = navMark();
      if (m) m.style.opacity = docked ? "1" : "0";
      if (docked) root.dataset.ajHeroDone = "1";
      else delete root.dataset.ajHeroDone;
    };

    const fallback = () => {
      if (fallbackRef.current) fallbackRef.current.hidden = false;
      canvas.style.display = "none";
      section.dataset.static = "1";
      setDocked(true);
    };

    if (reduced) section.dataset.static = "1";

    const resize = () => {
      if (!scene) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      scene.resize(w, h, window.devicePixelRatio || 1);
      rect = scene.logoRect();
      measureTarget();
      lastP = -1;
      // Resizing clears the canvas; the reduced-motion still frame has to be redrawn.
      if (reduced) scene.render(0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onPointer = (e: PointerEvent) => {
      if (!scene || e.pointerType === "touch") return;
      scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    // One layout read per frame: the section rect gives both progress and visibility.
    const read = () => {
      const r = section.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = r.height - vh;
      const p = reduced ? 0 : total > 0 ? clamp01(-r.top / total) : 0;
      return { p, onScreen: r.bottom > 0 && r.top < vh };
    };

    let narrow = window.innerWidth < 768;
    const onResize = () => {
      narrow = window.innerWidth < 768;
      lastP = -1;
    };
    window.addEventListener("resize", onResize, { passive: true });

    const updateDom = (p: number) => {
      const copy = copyRef.current!;
      const o = 1 - smooth(seg(p, T.copyOut[0], T.copyOut[1]));
      copy.style.opacity = String(o);
      copy.style.transform = `translate3d(0, ${((narrow ? -10 : -48) * (1 - o)).toFixed(2)}px, 0)`;
      copy.style.filter = o < 0.999 ? `blur(${((1 - o) * 8).toFixed(2)}px)` : "";
      copy.style.visibility = o <= 0.001 ? "hidden" : "visible";

      T.captions.forEach(([a, b], i) => {
        const el = capRefs.current[i];
        if (!el) return;
        const w = windowed(p, a, b);
        const dir = p < (a + b) / 2 ? 1 : -1;
        el.style.opacity = String(w);
        // Phones: arrive from below, leave by fading in place, so nothing slides under the nav.
        const travel = narrow ? (dir > 0 ? 18 : 0) : 32;
        el.style.transform = `translate3d(0, ${(dir * (1 - w) * travel).toFixed(2)}px, 0)`;
        el.style.visibility = w <= 0.001 ? "hidden" : "visible";
      });

      const meet = meetRef.current!;
      const mw = windowed(p, T.meet[0], T.meet[1], 0.14);
      meet.style.opacity = String(mw);
      meet.style.visibility = mw <= 0.001 ? "hidden" : "visible";
      meet.style.top = `${(rect.y + rect.r + 28).toFixed(1)}px`;
      meet.style.transform = `translate3d(-50%, ${((1 - mw) * (p < 0.86 ? 18 : -10)).toFixed(2)}px, 0)`;

      // Canvas hands over to the vector mark, which then docks into the nav.
      const hand = reduced ? 0 : smooth(seg(p, T.handoff[0], T.handoff[1]));
      canvas.style.opacity = String(1 - hand);
      const overlay = overlayRef.current!;
      // Reduced motion: no scroll story, the mark simply lives in the nav.
      const docked = reduced || p >= T.dock[1];
      if (hand > 0 && !docked) {
        const k = easeInOut(seg(p, T.dock[0], T.dock[1]));
        const sx = rect.x - rect.r;
        const sy = rect.y - rect.r;
        const sd = rect.r * 2;
        // Arc in: x leads and y trails, so the mark arrives from below its slot and never crosses the wordmark.
        const kx = 1 - Math.pow(1 - k, 2.6);
        const ky = Math.pow(k, 1.7);
        const x = target ? lerp(sx, target.left, kx) : sx;
        const y = target ? lerp(sy, target.top, ky) : sy;
        const d = target ? lerp(sd, target.width, kx) : sd;
        overlay.style.opacity = String(hand);
        overlay.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${(d / OVERLAY_BASE).toFixed(5)})`;
        overlay.style.visibility = "visible";
      } else {
        overlay.style.opacity = "0";
        overlay.style.visibility = "hidden";
      }
      setDocked(docked);
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const { p, onScreen } = read();
      const time = reduced ? 0 : (performance.now() - t0) / 1000;
      if (p !== lastP) {
        updateDom(p);
        lastP = p;
      }
      if (scene && onScreen && p < T.handoff[1]) scene.render(p, time);
      if (reduced && scene) {
        // One still frame is enough.
        cancelAnimationFrame(raf);
      }
    };

    updateDom(read().p);
    import("@/janice/three/JaniceScene")
      .then(({ JaniceScene }) => {
        if (disposed) return;
        try {
          const mobile = window.innerWidth / window.innerHeight < 0.9;
          scene = new JaniceScene(canvas, { mobile, envUrl: "/img/studio-env.jpg" });
        } catch {
          fallback();
          return;
        }
        resize();
        if (reduced) {
          scene.render(0, 0);
          setDocked(true);
          // Redraw once the studio reflection map has streamed in.
          stills.push(window.setTimeout(() => scene?.render(0, 0), 1500), window.setTimeout(() => scene?.render(0, 0), 4000));
        }
        canvas.dataset.ready = "1";
        loop();
      })
      .catch(fallback);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      stills.forEach(clearTimeout);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
      scene?.dispose();
      delete root.dataset.ajHeroDone;
    };
  }, []);

  return (
    <section ref={sectionRef} id="top" aria-label="Ask Janice" className="aj-hero-scroll relative">
      <div className="sticky top-0 h-[100dvh] overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="aj-glow left-[42%] top-[8%] h-[60vh] w-[60vw] bg-[radial-gradient(closest-side,#e7e1ff,transparent)]" />
          <div className="aj-glow -left-[10%] bottom-[-10%] h-[50vh] w-[50vw] bg-[radial-gradient(closest-side,#efeaff,transparent)]" />
        </div>

        <canvas
          ref={canvasRef}
          aria-hidden
          className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-700 data-[ready=1]:opacity-100"
        />

        <div ref={fallbackRef} hidden aria-hidden className="absolute right-[8%] top-1/2 -translate-y-1/2 max-md:right-1/2 max-md:top-[72%] max-md:translate-x-1/2">
          <JaniceMark className="size-[min(34vh,60vw)] drop-shadow-[0_30px_60px_rgba(158,76,255,0.35)]" />
        </div>

        <div className="relative mx-auto h-full max-w-[1200px] px-5 sm:px-8">
          {/* Hero copy */}
          <div
            ref={copyRef}
            className="absolute inset-x-5 top-[calc(var(--aj-nav-h,72px)+20px)] will-change-transform sm:inset-x-8 md:top-1/2 md:max-w-[660px] md:-translate-y-[46%]"
          >
            <h1 className="aj-display text-[42px] leading-[1.04] text-aj-ink sm:text-[54px] lg:text-[62px]">
              <span className="lg:block lg:whitespace-nowrap">Your AI receptionist</span>{" "}
              <span className="aj-payoff inline-block pb-1 lg:whitespace-nowrap">never misses a call.</span>
            </h1>
            <p className="mt-5 max-w-[30rem] text-[17px] leading-[1.6] text-aj-slate sm:text-[18.5px]">
              Janice answers your business phone 24/7, captures every lead and books the job into your calendar.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href={SIGNUP_HREF} className="aj-btn aj-btn-primary h-[52px] px-6 text-[15.5px]">
                Start free trial
                <ArrowRightIcon size={17} weight="bold" className="aj-arrow" />
              </a>
              <a href="#pricing" className="aj-btn aj-btn-secondary h-[52px] px-6 text-[15.5px]">
                See pricing
              </a>
            </div>
          </div>

          {/* Story captions */}
          {CAPTIONS.map((c, i) => (
            <div
              key={c.title}
              ref={(el) => {
                capRefs.current[i] = el;
              }}
              className="aj-caption invisible absolute inset-x-5 top-[calc(var(--aj-nav-h,72px)+28px)] opacity-0 sm:inset-x-8 md:top-1/2 md:max-w-[440px] md:-translate-y-1/2"
            >
              <h2 className="aj-display text-[32px] leading-[1.06] text-aj-ink sm:text-[44px] lg:text-[52px]">{c.title}</h2>
              <p className="mt-4 max-w-[26rem] text-[16.5px] leading-[1.6] text-aj-slate sm:text-[18px]">{c.body}</p>
            </div>
          ))}
        </div>

        <div
          ref={meetRef}
          className="invisible absolute left-1/2 top-[70%] w-full max-w-[640px] px-5 text-center opacity-0"
        >
          <p className="aj-display text-[40px] text-aj-ink sm:text-[60px]">
            Hi, I’m <span className="aj-payoff">Janice.</span>
          </p>
          <p className="mt-3 text-[16px] text-aj-slate sm:text-[18px]">Your AI receptionist. $49 a month, unlimited calls.</p>
        </div>
      </div>

      {/* The vector mark that takes over from the 3D coin and docks into the nav. */}
      <div
        ref={overlayRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[60] origin-top-left opacity-0"
        style={{ width: OVERLAY_BASE, height: OVERLAY_BASE, visibility: "hidden" }}
      >
        <JaniceMark size={OVERLAY_BASE} />
      </div>
    </section>
  );
}
