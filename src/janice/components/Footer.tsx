import { Lockup } from "@/janice/components/Logo";
import { CONTACT_EMAIL, LEGAL, NAV, PHONE_DISPLAY, PHONE_HREF, SIGNIN_HREF } from "@/janice/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-aj-line bg-aj-paper">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
        <div>
          <Lockup height={30} />
          <p className="mt-5 max-w-[22rem] text-[14.5px] leading-[1.65] text-aj-slate">
            The AI receptionist that never sleeps. Answers your calls 24/7, captures leads and books appointments straight into
            your calendar.
          </p>
        </div>
        <nav aria-label="Product">
          <h2 className="font-display text-[15px] font-bold text-aj-ink">Product</h2>
          <ul className="mt-4 grid gap-2.5">
            {NAV.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="text-[14.5px] text-aj-slate hover:text-aj-ink">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="font-display text-[15px] font-bold text-aj-ink">Contact</h2>
          <ul className="mt-4 grid gap-2.5 text-[14.5px]">
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-aj-slate hover:text-aj-ink">
                {CONTACT_EMAIL}
              </a>
            </li>
            <li>
              <a href={PHONE_HREF} className="aj-num text-aj-slate hover:text-aj-ink">
                {PHONE_DISPLAY}
              </a>
            </li>
            <li>
              <a href={SIGNIN_HREF} className="text-aj-slate hover:text-aj-ink">
                Sign in
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-aj-line">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-5 py-6 text-[13px] text-aj-slate sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© 2026 Ask Janice. All rights reserved.</p>
          <ul className="flex gap-5">
            {LEGAL.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="hover:text-aj-ink">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
