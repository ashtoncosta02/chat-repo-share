import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { needsAnswer, onConsentChange, readChoice, saveChoices, type Purpose } from "@/lib/consent";

const PURPOSES: Purpose[] = ["analytics", "advertising"];
const OPEN_SETTINGS_EVENT = "open-cookie-settings";

/** Opens the Cookie settings panel from anywhere (footer links, privacy page). */
export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}

function hasGpc() {
  return (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

export function CookieBanner() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // The chat widget is shown on customers' websites; our banner never appears there.
  const hidden = pathname === "/widget" || pathname.startsWith("/widget/");
  const [showBanner, setShowBanner] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gpc, setGpc] = useState(false);
  const [draft, setDraft] = useState<Record<Purpose, boolean>>({ analytics: false, advertising: false });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    const check = () => {
      void needsAnswer(PURPOSES).then((needed) => {
        if (!cancelled) setShowBanner(needed);
      });
    };
    check();
    const unsubscribe = onConsentChange(check);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [hidden]);

  useEffect(() => {
    const open = () => {
      setGpc(hasGpc());
      setDraft({
        analytics: readChoice("analytics") === "granted",
        advertising: readChoice("advertising") === "granted",
      });
      setSettingsOpen(true);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, open);
  }, []);

  useEffect(() => {
    if (showBanner && !settingsOpen) panelRef.current?.focus();
  }, [showBanner, settingsOpen]);

  const answerAll = (choice: "granted" | "denied") => {
    saveChoices({ analytics: choice, advertising: choice });
    setShowBanner(false);
  };

  const saveSettings = () => {
    saveChoices({
      analytics: draft.analytics ? "granted" : "denied",
      advertising: draft.advertising ? "granted" : "denied",
    });
    setSettingsOpen(false);
    setShowBanner(false);
  };

  if (hidden) return null;

  return (
    <>
      {showBanner && !settingsOpen && (
        <div
          ref={panelRef}
          role="region"
          aria-label="Cookie choices"
          tabIndex={-1}
          className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-xl rounded-xl border border-border bg-card p-5 text-card-foreground shadow-lg outline-none sm:inset-x-6 sm:bottom-6"
        >
          <p className="font-display text-base font-semibold">Your privacy choices</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We count visits without cookies. If you accept, we also measure clicks, and use advertising
            cookies to see how our ads perform.{" "}
            <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy policy
            </Link>
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="grid flex-1 grid-cols-2 gap-2">
              <Button onClick={() => answerAll("granted")}>Accept all</Button>
              <Button onClick={() => answerAll("denied")}>Reject all</Button>
            </div>
            <Button variant="ghost" onClick={openCookieSettings}>
              Cookie settings
            </Button>
          </div>
        </div>
      )}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cookie settings</DialogTitle>
            <DialogDescription>
              Choose what we may use. You can change this any time from the Cookie settings link.
            </DialogDescription>
          </DialogHeader>
          {gpc && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Your browser's privacy signal (Global Privacy Control) is on, so analytics and advertising
              stay off.
            </p>
          )}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Necessary</p>
                <p className="text-sm text-muted-foreground">Keeps you signed in and the site secure. Always on.</p>
              </div>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="consent-analytics" className="text-sm font-medium">
                  Analytics, provided by Lovable
                </Label>
                <p className="text-sm text-muted-foreground">Measures clicks so we can improve the site.</p>
              </div>
              <Switch
                id="consent-analytics"
                checked={!gpc && draft.analytics}
                disabled={gpc}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, analytics: v }))}
              />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="consent-advertising" className="text-sm font-medium">
                  Advertising, provided by Meta
                </Label>
                <p className="text-sm text-muted-foreground">
                  Uses cookies to measure how our ads on Facebook and Instagram perform.
                </p>
              </div>
              <Switch
                id="consent-advertising"
                checked={!gpc && draft.advertising}
                disabled={gpc}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, advertising: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveSettings}>Save choices</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
