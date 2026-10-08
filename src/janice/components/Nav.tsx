import { useEffect, useRef, useState, type ReactNode } from "react";
import { ListIcon, XIcon } from "@phosphor-icons/react";
import { JaniceMark, Wordmark } from "@/janice/components/Logo";
import { NAV, SIGNIN_HREF, SIGNUP_HREF } from "@/janice/lib/site";

/**
 * The mark slot (#aj-nav-mark) starts empty: the hero’s 3D coin becomes the mark and lands here.
 * Before the landing the wordmark carries the brand on its own.
 */
export function Nav({ banner }: { banner?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  // Content under the fixed header (hero copy, captions) is positioned from its real height.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const root = document.documentElement;
    const bar = el.querySelector("nav");
    const set = () => root.style.setProperty("--aj-nav-h", `${Math.round((bar?.getBoundingClientRect().bottom ?? 72))}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--aj-nav-h");
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header ref={headerRef} className="aj-site-nav fixed inset-x-0 top-0 z-50">
      {banner ? <div className="relative z-[1]">{banner}</div> : null}
      <div className="aj-nav-surface absolute inset-0" aria-hidden />
      <nav aria-label="Main" className="aj-safe-x relative mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <a href="#top" className="flex items-center gap-[5px] rounded-full" aria-label="Ask Janice, back to top">
          {/* Lilac socket the 3D mark lands into; the mark itself fades in on arrival. */}
          <span className="aj-nav-socket relative block size-[32px] rounded-full">
            <span id="aj-nav-mark" className="block size-[32px] rounded-full opacity-0">
              <JaniceMark size={32} />
            </span>
          </span>
          <Wordmark height={32} />
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {NAV.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-full px-3.5 py-2 text-[14.5px] font-medium text-aj-slate transition-colors duration-200 hover:bg-aj-lavender/70 hover:text-aj-ink"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <a href={SIGNIN_HREF} className="hidden rounded-full px-3.5 py-2 text-[14.5px] font-medium text-aj-slate hover:text-aj-ink sm:inline-flex">
            Sign in
          </a>
          <a href={SIGNUP_HREF} className="aj-btn aj-btn-primary hidden h-10 px-5 text-[14px] sm:inline-flex">
            Start free trial
          </a>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full text-aj-ink hover:bg-aj-lavender md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <XIcon size={22} weight="bold" /> : <ListIcon size={22} weight="bold" />}
          </button>
        </div>
      </nav>

      <div
        id="mobile-menu"
        hidden={!open}
        className="relative mx-3 max-h-[calc(100dvh-88px)] overflow-y-auto overscroll-contain rounded-[24px] bg-aj-paper p-3 shadow-[var(--shadow-aj-lift)] ring-1 ring-aj-line md:hidden"
      >
        <ul className="grid">
          {NAV.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3.5 text-[17px] font-medium text-aj-ink hover:bg-aj-mist">
                {l.label}
              </a>
            </li>
          ))}
          <li>
            <a href={SIGNIN_HREF} className="block rounded-2xl px-4 py-3.5 text-[17px] font-medium text-aj-slate hover:bg-aj-mist">
              Sign in
            </a>
          </li>
        </ul>
        <a href={SIGNUP_HREF} className="aj-btn aj-btn-primary mt-2 h-[52px] w-full text-[16px]">
          Start free trial
        </a>
      </div>
    </header>
  );
}
