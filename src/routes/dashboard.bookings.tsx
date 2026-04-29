import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/PageHeader";
import { Calendar, Mail, Phone, User as UserIcon, Clock } from "lucide-react";

export const Route = createFileRoute("/dashboard/bookings")({
  head: () => ({ meta: [{ title: "Bookings — Agent Factory" }] }),
  component: BookingsPage,
});

interface BookingRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  source: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  reason: string | null;
  google_event_id: string | null;
  created_at: string;
  agent_id: string;
}

interface AgentMini {
  id: string;
  business_name: string;
}

type Tab = "upcoming" | "past";

function BookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [agents, setAgents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("upcoming");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: bks }, { data: ags }] = await Promise.all([
        supabase
          .from("calendar_bookings")
          .select(
            "id, starts_at, ends_at, status, source, customer_name, customer_email, customer_phone, reason, google_event_id, created_at, agent_id",
          )
          .order("starts_at", { ascending: true }),
        supabase.from("agents").select("id, business_name"),
      ]);
      if (cancelled) return;
      setBookings((bks ?? []) as BookingRow[]);
      const map: Record<string, string> = {};
      for (const a of (ags ?? []) as AgentMini[]) map[a.id] = a.business_name;
      setAgents(map);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const now = Date.now();
  const upcoming = useMemo(
    () =>
      bookings
        .filter((b) => new Date(b.ends_at).getTime() >= now && b.status !== "cancelled")
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [bookings, now],
  );
  const past = useMemo(
    () =>
      bookings
        .filter((b) => new Date(b.ends_at).getTime() < now || b.status === "cancelled")
        .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()),
    [bookings, now],
  );

  const visible = tab === "upcoming" ? upcoming : past;

  // Stats
  const next7 = upcoming.filter(
    (b) => new Date(b.starts_at).getTime() - now < 7 * 24 * 60 * 60 * 1000,
  ).length;

  return (
    <div>
      <PageHeader
        title="Bookings"
        description="Appointments booked by your AI agents on your Google Calendar"
      />
      <div className="p-4 md:p-8 space-y-4 md:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat label="Upcoming" value={upcoming.length} color="text-emerald-600" />
          <Stat label="Next 7 days" value={next7} color="text-foreground" />
          <Stat label="Total booked" value={bookings.length} color="text-blue-600" />
        </div>

        <div className="flex gap-2">
          <TabBtn active={tab === "upcoming"} onClick={() => setTab("upcoming")}>
            Upcoming ({upcoming.length})
          </TabBtn>
          <TabBtn active={tab === "past"} onClick={() => setTab("past")}>
            Past ({past.length})
          </TabBtn>
        </div>

        <div className="rounded-xl border border-border bg-card">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-16 w-16 text-muted-foreground/40" />}
              title={tab === "upcoming" ? "No upcoming bookings" : "No past bookings"}
              description={
                tab === "upcoming"
                  ? "When your AI agent books an appointment for a visitor, it will show up here."
                  : "Past appointments will appear here once they've ended."
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((b) => (
                <BookingItem key={b.id} booking={b} agentName={agents[b.agent_id]} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function BookingItem({
  booking,
  agentName,
}: {
  booking: BookingRow;
  agentName: string | undefined;
}) {
  const start = new Date(booking.starts_at);
  const end = new Date(booking.ends_at);
  const dateStr = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: start.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
  const timeStr = `${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
  const cancelled = booking.status === "cancelled";

  return (
    <li className="px-4 md:px-6 py-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <UserIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-foreground">
              {booking.customer_name || "Unknown"}
            </span>
            {cancelled && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                Cancelled
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {booking.source}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {dateStr}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeStr} ({durationMin}m)
            </span>
            {booking.customer_email && (
              <a
                href={`mailto:${booking.customer_email}`}
                className="flex items-center gap-1 hover:text-[var(--gold)] break-all"
              >
                <Mail className="h-3 w-3" />
                {booking.customer_email}
              </a>
            )}
            {booking.customer_phone && (
              <a
                href={`tel:${booking.customer_phone}`}
                className="flex items-center gap-1 hover:text-[var(--gold)]"
              >
                <Phone className="h-3 w-3" />
                {booking.customer_phone}
              </a>
            )}
          </div>
          {booking.reason && (
            <div className="mt-2 text-sm text-foreground/80 italic">"{booking.reason}"</div>
          )}
          {agentName && (
            <div className="mt-2 text-xs text-muted-foreground">via {agentName}</div>
          )}
        </div>
        {booking.google_event_id && (
          <a
            href={`https://calendar.google.com/calendar/u/0/r/eventedit/${booking.google_event_id}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[var(--gold)] hover:underline flex-shrink-0"
          >
            Open in Google Calendar →
          </a>
        )}
      </div>
    </li>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className={`font-display text-3xl font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--gold)] text-white"
          : "bg-card border border-border text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
