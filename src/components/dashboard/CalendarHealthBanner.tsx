import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link, useLocation } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getGoogleCalendarHealth } from "@/lib/google-calendar.functions";

interface Props {
  agentId: string;
}

type HealthStatus = "ok" | "not_connected" | "needs_reconnect" | "error" | null;

export function CalendarHealthBanner({ agentId }: Props) {
  const location = useLocation();
  const healthFn = useServerFn(getGoogleCalendarHealth);
  const [status, setStatus] = useState<HealthStatus>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const { data: session } = await supabase.auth.getSession();
        const accessToken = session.session?.access_token;
        if (!accessToken) return;
        const result = await healthFn({ data: { accessToken, agent_id: agentId } });
        if (!cancelled) setStatus(result.status);
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
  }, [agentId, healthFn]);

  if (
    location.pathname === "/dashboard/onboarding" ||
    location.pathname.startsWith("/dashboard/admin")
  ) {
    return null;
  }

  if (status !== "needs_reconnect") return null;

  return (
    <div className="border-b border-red-200 bg-red-50 px-4 py-3 md:px-6">
      <div className="mx-auto flex max-w-6xl items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
        <div className="flex-1 text-sm">
          <p className="font-semibold text-red-900">Google Calendar disconnected</p>
          <p className="mt-0.5 text-red-800">
            Your AI Receptionist can't book appointments until you reconnect Google Calendar.
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
