import { useEffect, useRef, useState } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { canTrack, onConsentChange } from "@/lib/consent";
import { isPixelPath, setPixelActive, trackConversion } from "@/lib/meta-pixel";
import { getCheckoutConversion } from "@/lib/checkout-conversion.functions";
import { getStripeEnvironment } from "@/lib/stripe";

const CHECKOUT_PARAM = "checkout_session";
const SENT_PREFIX = "meta_conversion_sent_";
const PENDING_KEY = "meta_pending_checkout";

/**
 * Remember the returned checkout ID straight away: the dashboard may redirect (onboarding, sign-in)
 * and drop it from the address bar before the account has loaded.
 */
function rememberPendingCheckout() {
  const id = new URLSearchParams(window.location.search).get(CHECKOUT_PARAM);
  if (!id) return;
  try {
    sessionStorage.setItem(PENDING_KEY, id);
  } catch {
    /* ignore */
  }
}

function pendingCheckout(): string | null {
  const fromUrl = new URLSearchParams(window.location.search).get(CHECKOUT_PARAM);
  if (fromUrl) return fromUrl;
  try {
    return sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

function clearPendingCheckout() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
  stripCheckoutParam();
}

function alreadySent(sessionId: string): boolean {
  try {
    return localStorage.getItem(SENT_PREFIX + sessionId) !== null;
  } catch {
    return false;
  }
}

function markSent(sessionId: string) {
  try {
    localStorage.setItem(SENT_PREFIX + sessionId, String(Date.now()));
  } catch {
    /* storage blocked: the URL cleanup below still prevents a refresh resend */
  }
}

/** Remove the checkout ID from the address bar so a refresh can't report the same checkout again. */
function stripCheckoutParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(CHECKOUT_PARAM)) return;
  url.searchParams.delete(CHECKOUT_PARAM);
  url.searchParams.delete("checkout");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

/** Starts, pauses and resumes the Meta Pixel from the visitor's advertising choice and the page. */
export function MetaPixel() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const allowed = useRef(false);
  const checkoutsInFlight = useRef(new Set<string>());
  const [consentVersion, setConsentVersion] = useState(0);

  useEffect(() => {
    rememberPendingCheckout();
    return onConsentChange(() => setConsentVersion((v) => v + 1));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const onPixelPage = () => isPixelPath(router.state.location.pathname);

    const refreshPermission = () => {
      void canTrack("advertising").then((ok) => {
        if (cancelled) return;
        allowed.current = ok;
        // Initial load or a new acceptance: the first start sends this page's single PageView.
        setPixelActive(ok && onPixelPage(), false);
      });
    };

    refreshPermission();
    const unsubscribeConsent = onConsentChange(refreshPermission);

    return () => {
      cancelled = true;
      unsubscribeConsent();
    };
  }, [router]);

  // One PageView per page change (path only: in-page anchors and filters don't count).
  const pathname = useRouterState({ select: (s) => (s.resolvedLocation ?? s.location).pathname });
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (lastPath.current === null || lastPath.current === pathname) {
      lastPath.current = pathname;
      return;
    }
    lastPath.current = pathname;
    setPixelActive(allowed.current && isPixelPath(pathname), true);
  }, [pathname]);

  // StartTrial / Purchase: only after Stripe confirms the signed-in account's checkout finished.
  useEffect(() => {
    if (!userId) return;
    const sessionId = pendingCheckout();
    if (!sessionId || checkoutsInFlight.current.has(sessionId)) return;
    if (alreadySent(sessionId)) {
      clearPendingCheckout();
      return;
    }
    checkoutsInFlight.current.add(sessionId);
    void (async () => {
      try {
        // No advertising permission: nothing is checked or sent. The ID stays in the address bar
        // in case the visitor accepts on this page.
        if (!(await canTrack("advertising"))) return;
        const conversion = await getCheckoutConversion({
          data: { sessionId, environment: getStripeEnvironment() },
        });
        if (!conversion) {
          // Not a confirmed, finished checkout for this account: report nothing, don't retry.
          clearPendingCheckout();
          return;
        }
        if (alreadySent(sessionId) || !(await canTrack("advertising"))) return;
        markSent(sessionId);
        clearPendingCheckout();
        trackConversion(conversion.event, conversion.params, conversion.eventId);
      } catch {
        /* never interrupt the dashboard */
      } finally {
        checkoutsInFlight.current.delete(sessionId);
      }
    })();
  }, [userId, consentVersion]);

  return null;
}
