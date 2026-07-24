import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Auto-detects new deployments by polling the app's main script hash.
 * When the hash changes, shows a lime banner prompting the user to refresh.
 * Works across all worker instances because Vite emits content-hashed asset names.
 */
async function getCurrentAssetHash(): Promise<string | null> {
  try {
    const res = await fetch("/", { cache: "no-store" });
    if (!res.ok) return null;
    const html = await res.text();
    // Grab all hashed JS asset srcs, join into a single fingerprint
    const matches = Array.from(html.matchAll(/\/assets\/([A-Za-z0-9._-]+\.js)/g));
    if (matches.length === 0) return null;
    return matches.map((m) => m[1]).sort().join("|");
  } catch {
    return null;
  }
}

export function NewVersionBanner() {
  const [initialHash, setInitialHash] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isDashboard = pathname.startsWith("/dashboard");

  useEffect(() => {
    let cancelled = false;

    // Capture initial fingerprint once
    getCurrentAssetHash().then((h) => {
      if (!cancelled) setInitialHash(h);
    });

    const interval = setInterval(async () => {
      if (!initialHash) return;
      const current = await getCurrentAssetHash();
      if (current && current !== initialHash) {
        setUpdateAvailable(true);
      }
    }, 60_000);

    // Also check when tab regains focus
    const onVisible = async () => {
      if (document.visibilityState !== "visible" || !initialHash) return;
      const current = await getCurrentAssetHash();
      if (current && current !== initialHash) setUpdateAvailable(true);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [initialHash]);

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3 rounded-full border border-lime-400/40 bg-lime-400 px-4 py-2 shadow-lg">
        <span className="text-sm font-medium text-lime-950">
          A new version is available
        </span>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 rounded-full bg-lime-950 px-3 py-1 text-xs font-semibold text-lime-50 transition-colors hover:bg-lime-900"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>
    </div>
  );
}

/** Read the currently-loaded fingerprint from <script> tags in the DOM. */
export function getLoadedAssetHash(): string | null {
  if (typeof document === "undefined") return null;
  const scripts = Array.from(document.querySelectorAll("script[src]"));
  const hashes = scripts
    .map((s) => {
      const src = s.getAttribute("src") || "";
      const m = src.match(/\/assets\/([A-Za-z0-9._-]+\.js)/);
      return m?.[1] ?? null;
    })
    .filter((x): x is string => !!x);
  if (hashes.length === 0) return null;
  return hashes.sort().join("|");
}
