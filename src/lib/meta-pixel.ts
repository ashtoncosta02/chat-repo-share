/**
 * Meta Pixel for askjanice.net. Loaded only after advertising permission (see src/lib/consent.ts),
 * never inside the customer chat widget, and paused on pages that show customers' private data.
 * Fires exactly one PageView on first load and one per page (path) change; Meta's own automatic
 * history tracking is turned off so it can't add a second PageView on navigation.
 */
export const META_PIXEL_ID = "1910459309922815";
const SCRIPT_SRC = "https://connect.facebook.net/en_US/fbevents.js";

type Fbq = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
  allowDuplicatePageViews?: boolean;
};

type PixelWindow = Window & { fbq?: Fbq; _fbq?: Fbq };

/** Pages where the Pixel never runs or pauses. The widget is embedded on customers' own websites. */
export function isPixelPath(pathname: string, includeDashboard = false): boolean {
  if (pathname === "/widget" || pathname.startsWith("/widget/")) return false;
  if (!includeDashboard && (pathname === "/dashboard" || pathname.startsWith("/dashboard/"))) return false;
  return true;
}

let loaded = false;
let sending = false;

/** Meta's base snippet, unchanged in behaviour: queue calls until fbevents.js loads. */
function ensureFbq(): Fbq {
  const w = window as PixelWindow;
  if (w.fbq) return w.fbq;
  const n = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod.apply(n, args);
    else n.queue.push(args);
  } as Fbq;
  if (!w._fbq) w._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  // We send PageView ourselves on each route change; stop Meta adding its own on history changes.
  n.disablePushState = true;
  // Without this, fbevents.js drops every PageView after the first one on a single-page site.
  n.allowDuplicatePageViews = true;
  w.fbq = n;
  const t = document.createElement("script");
  t.async = true;
  t.src = SCRIPT_SRC;
  const s = document.getElementsByTagName("script")[0];
  if (s?.parentNode) s.parentNode.insertBefore(t, s);
  else document.head.appendChild(t);
  return n;
}

/**
 * Turn sending on or off. `pageView` asks for a PageView for a page change; the very first load
 * always sends one PageView itself, so the flag is ignored then (no duplicates).
 */
export function setPixelActive(on: boolean, pageView: boolean): void {
  if (typeof window === "undefined") return;
  if (on) {
    if (!loaded) {
      const fbq = ensureFbq();
      fbq("init", META_PIXEL_ID, {}, { agent: "lovable" });
      fbq("track", "PageView");
      loaded = true;
      sending = true;
      return;
    }
    const fbq = (window as PixelWindow).fbq;
    if (!fbq) return;
    if (!sending) {
      fbq("consent", "grant");
      sending = true;
    }
    if (pageView) fbq("track", "PageView");
    return;
  }
  if (loaded && sending) {
    (window as PixelWindow).fbq?.("consent", "revoke");
  }
  sending = false;
}

/**
 * Sends one confirmed checkout conversion. Works on dashboard pages too: if the Pixel is paused or not
 * loaded there, it is woken for this event only (no PageView) and paused again right after.
 * Callers must already have advertising permission.
 */
export function trackConversion(event: string, params: Record<string, string | number>, eventId: string): void {
  if (typeof window === "undefined") return;
  let fbq = (window as PixelWindow).fbq;
  const wasSending = loaded && sending;
  if (!loaded || !fbq) {
    fbq = ensureFbq();
    fbq("init", META_PIXEL_ID, {}, { agent: "lovable" });
    loaded = true;
  } else if (!sending) {
    fbq("consent", "grant");
  }
  fbq("track", event, params, { eventID: eventId });
  if (!wasSending) {
    fbq("consent", "revoke");
    sending = false;
  }
}

/** Test helper: forget the module state. */
export function resetPixelStateForTests(): void {
  loaded = false;
  sending = false;
}
