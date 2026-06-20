import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "aj.adminReturnSession";

type SavedSession = {
  access_token: string;
  refresh_token: string;
  admin_email?: string;
};

export function saveAdminReturnSession(session: { access_token: string; refresh_token: string }, adminEmail?: string) {
  const payload: SavedSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    admin_email: adminEmail,
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function ImpersonationBanner({ currentEmail }: { currentEmail?: string }) {
  const [saved, setSaved] = useState<SavedSession | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  if (!saved) return null;

  const returnToAdmin = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.setSession({
        access_token: saved.access_token,
        refresh_token: saved.refresh_token,
      });
      if (error) {
        toast.error("Could not restore your admin session. Please sign in again.");
        sessionStorage.removeItem(STORAGE_KEY);
        await supabase.auth.signOut();
        window.location.href = "/auth";
        return;
      }
      sessionStorage.removeItem(STORAGE_KEY);
      window.location.href = "/dashboard/admin";
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2.5 flex items-center justify-between gap-4 text-amber-900">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm truncate">
          Admin view — signed in as <strong>{currentEmail ?? "client"}</strong>
          {saved.admin_email ? <> (your admin: {saved.admin_email})</> : null}
        </span>
      </div>
      <button
        onClick={returnToAdmin}
        disabled={busy}
        className="text-sm font-medium rounded-md border border-amber-400 bg-white px-3 py-1.5 hover:bg-amber-100 disabled:opacity-60 whitespace-nowrap"
      >
        {busy ? "Returning…" : "Return to admin"}
      </button>
    </div>
  );
}
