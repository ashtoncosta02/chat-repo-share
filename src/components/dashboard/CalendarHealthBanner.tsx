import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useLocation } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getGoogleCalendarHealth } from "@/lib/google-calendar.functions";

interface Props {
  agentId: string;
}

export function CalendarHealthBanner({ agentId }: Props) {
  const location = useLocation();
  const healthFn = useServerFn(getGoogleCalendarHealth);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token ?? null);
    });
  }, []);

  const { data } = useQuery({
    queryKey: ["google-calendar-health", agentId],
    queryFn: () => healthFn({ data: { accessToken: accessToken!, agent_id: agentId } }),
    enabled: !!accessToken && !!agentId,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    staleTime: 60 * 1000,
  });

  // Hide on onboarding and admin routes
  if (
    location.pathname === "/dashboard/onboarding" ||
    location.pathname.startsWith("/dashboard/admin")
  ) {
    return null;
  }

  if (!data || data.status !== "needs_reconnect") return null;

  return (
    <div className="border-b border-red-200 bg-red-50 px-4 py-3 md:px-6">
      <div className="mx-auto flex max-w-6xl items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
        <div className="flex-1 text-sm">
          <p className="font-semibold text-red-900">
            Google Calendar disconnected
          </p>
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
