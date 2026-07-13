import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link, useLocation } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getGoogleCalendarHealth } from "@/lib/google-calendar.functions";
import { getOutlookCalendarHealth } from "@/lib/outlook-calendar.functions";

interface Props {
  agentId: string;
}

type Provider = "google" | "outlook";

export function CalendarHealthBanner({ agentId }: Props) {
  const location = useLocation();
  const googleHealth = useServerFn(getGoogleCalendarHealth);
  const outlookHealth = useServerFn(getOutlookCalendarHealth);
  const [disconnected, setDisconnected] = useState<Provider | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const { data: session } = await supabase.auth.getSession();
        const accessToken = session.session?.access_token;
        if (!accessToken) return;
        const [g, o] = await Promise.all([
          googleHealth({ data: { accessToken, agent_id: agentId } }).catch(() => null),
          outlookHealth({ data: { accessToken, agent_id: agentId } }).catch(() => null),
        ]);
        if (cancelled) return;
        if (g?.status === "needs_reconnect") setDisconnected("google");
        else if (o?.status === "needs_reconnect") setDisconnected("outlook");
        else setDisconnected(null);
      } catch (e) {
        console.error("calendar health check failed", e);
      }
    }

    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [agentId, googleHealth, outlookHealth]);

  if (
    location.pathname === "/dashboard/onboarding" ||
    location.pathname.startsWith("/dashboard/admin")
  ) {
    return null;
  }

  if (!disconnected) return null;

  const label = disconnected === "google" ? "Google Calendar" : "Outlook Calendar";

  return (
    <div className="border-b border-red-200 bg-red-50 px-4 py-3 md:px-6">
      <div className="mx-auto flex max-w-6xl items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
        <div className="flex-1 text-sm">
          <p className="font-semibold text-red-900">{label} disconnected</p>
          <p className="mt-0.5 text-red-800">
            Your AI Receptionist can't book appointments until you reconnect {label}.
          </p>
        </div>
        <Link
          to="/dashboard/agent"
          className="flex-shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          Reconnect
        </Link>
      </div>
    </div>
  );
}
