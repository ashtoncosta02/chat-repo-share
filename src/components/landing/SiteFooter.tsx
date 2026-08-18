import { Link } from "@tanstack/react-router";
import { Mail, Phone } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-display text-xl font-bold tracking-tight">
            Ask <span className="text-gold">Janice</span>
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            The AI receptionist that never sleeps. Answers your calls 24/7, captures leads,
            and books appointments straight into your calendar.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">Product</p>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li>
              <a href="#how-it-works" className="hover:text-foreground">How it works</a>
            </li>
            <li>
              <a href="#features" className="hover:text-foreground">Features</a>
            </li>
            <li>
              <a href="#pricing" className="hover:text-foreground">Pricing</a>
            </li>
            <li>
              <a href="#faq" className="hover:text-foreground">FAQ</a>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">Contact</p>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li>
              <a href="mailto:hello@askjanice.net" className="inline-flex items-center gap-2 hover:text-foreground">
                <Mail className="h-4 w-4" /> hello@askjanice.net
              </a>
            </li>
            <li>
              <a href="tel:+12899071201" className="inline-flex items-center gap-2 hover:text-foreground">
                <Phone className="h-4 w-4" /> (289) 907-1201
              </a>
            </li>
            <li>
              <Link to="/auth" className="hover:text-foreground">Sign in</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60 py-6">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Ask Janice. All rights reserved. ·{" "}
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link> ·{" "}
          <Link to="/terms" className="hover:text-foreground">Terms</Link> ·{" "}
          <Link to="/refund-policy" className="hover:text-foreground">Refunds</Link>
        </div>
      </div>
    </footer>
  );
}
