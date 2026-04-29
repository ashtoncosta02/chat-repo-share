import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/PageHeader";
import { Calendar, Mail, Phone, User as UserIcon, Clock, Plus, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createManualBooking } from "@/server/google-calendar.functions";

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
  const [calendarAgentIds, setCalendarAgentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [showDialog, setShowDialog] = useState(false);

  const refresh = async () => {
    const { data: bks } = await supabase
      .from("calendar_bookings")
      .select(
        "id, starts_at, ends_at, status, source, customer_name, customer_email, customer_phone, reason, google_event_id, created_at, agent_id",
      )
      .order("starts_at", { ascending: true });
    setBookings((bks ?? []) as BookingRow[]);
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: bks }, { data: ags }, { data: cals }] = await Promise.all([
        supabase
          .from("calendar_bookings")
          .select(
            "id, starts_at, ends_at, status, source, customer_name, customer_email, customer_phone, reason, google_event_id, created_at, agent_id",
          )
          .order("starts_at", { ascending: true }),
        supabase.from("agents").select("id, business_name"),
        supabase.from("agent_google_calendar").select("agent_id"),
      ]);
      if (cancelled) return;
      setBookings((bks ?? []) as BookingRow[]);
      const map: Record<string, string> = {};
      for (const a of (ags ?? []) as AgentMini[]) map[a.id] = a.business_name;
      setAgents(map);
      setCalendarAgentIds(((cals ?? []) as { agent_id: string }[]).map((c) => c.agent_id));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const bookableAgents = useMemo(
    () =>
      Object.entries(agents)
        .filter(([id]) => calendarAgentIds.includes(id))
        .map(([id, name]) => ({ id, name })),
    [agents, calendarAgentIds],
  );

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
        action={
          bookableAgents.length > 0 ? (
            <button
              onClick={() => setShowDialog(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--gold)] text-white text-sm font-medium hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              New Booking
            </button>
          ) : null
        }
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
                  ? "When your AI agent books an appointment for a visitor, it will show up here. Or click \"New Booking\" to add one manually."
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

      {showDialog && (
        <NewBookingDialog
          agents={bookableAgents}
          onClose={() => setShowDialog(false)}
          onCreated={async () => {
            setShowDialog(false);
            await refresh();
          }}
        />
      )}
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

function NewBookingDialog({
  agents,
  onClose,
  onCreated,
}: {
  agents: { id: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const createBooking = useServerFn(createManualBooking);
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(30);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        setError("Not signed in");
        return;
      }
      // Build local datetime then convert to ISO
      const startLocal = new Date(`${date}T${time}:00`);
      if (isNaN(startLocal.getTime())) {
        setError("Invalid date/time");
        return;
      }
      const result = await createBooking({
        data: {
          accessToken,
          agent_id: agentId,
          start_iso: startLocal.toISOString(),
          duration_minutes: duration,
          customer_name: name.trim(),
          customer_email: email.trim(),
          customer_phone: phone.trim() || undefined,
          reason: reason.trim() || undefined,
        },
      });
      if (!result.success) {
        setError(result.error ?? "Failed to create booking");
        return;
      }
      onCreated();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create booking");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-display text-xl font-semibold text-foreground">New Booking</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <Field label="Agent">
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
              />
            </Field>
            <Field label="Time">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
              />
            </Field>
          </div>
          <Field label="Duration (minutes)">
            <input
              type="number"
              min={5}
              max={480}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              required
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
            />
          </Field>
          <Field label="Customer name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
            />
          </Field>
          <Field label="Customer email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
            />
          </Field>
          <Field label="Phone (optional)">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
            />
          </Field>
          <Field label="Reason (optional)">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
            />
          </Field>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-[var(--gold)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create Booking"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            The customer will receive a calendar invite by email and the event will be added to your Google Calendar.
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}
