// Tool definitions + executors for the widget chat AI to book appointments.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkFreeBusy, createEvent, getValidAccessToken } from "./google-calendar.server";

export interface BusinessHoursDay {
  enabled: boolean;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}
export type BusinessHours = Record<
  "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday",
  BusinessHoursDay
>;

const DAY_KEYS: (keyof BusinessHours)[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export interface CalendarConfig {
  timezone: string;
  default_event_duration_minutes: number;
  booking_buffer_minutes: number;
  business_hours: BusinessHours;
}

export async function getCalendarConfig(agentId: string): Promise<CalendarConfig | null> {
  const { data } = await supabaseAdmin
    .from("agent_google_calendar")
    .select("timezone, default_event_duration_minutes, booking_buffer_minutes, business_hours")
    .eq("agent_id", agentId)
    .maybeSingle();
  if (!data) return null;
  return {
    timezone: data.timezone,
    default_event_duration_minutes: data.default_event_duration_minutes,
    booking_buffer_minutes: data.booking_buffer_minutes,
    business_hours: data.business_hours as unknown as BusinessHours,
  };
}

// Format a Date as "YYYY-MM-DD HH:mm" in a target IANA timezone.
function partsInTz(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === "24" ? "0" : parts.hour),
    minute: Number(parts.minute),
    weekday: parts.weekday, // "Mon", "Tue", ...
  };
}

const WEEKDAY_TO_KEY: Record<string, keyof BusinessHours> = {
  Sun: "sunday",
  Mon: "monday",
  Tue: "tuesday",
  Wed: "wednesday",
  Thu: "thursday",
  Fri: "friday",
  Sat: "saturday",
};

// Given a YYYY-MM-DD + HH:mm interpreted in `timeZone`, return the corresponding UTC Date.
function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  // Iterative approximation: build a UTC guess, then adjust by tz offset diff.
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const parts = partsInTz(guess, timeZone);
  const guessAsLocal = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  const diff = target - guessAsLocal;
  return new Date(guess.getTime() + diff);
}

function parseHHmm(s: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

interface AvailabilityArgs {
  date: string; // "YYYY-MM-DD" in the calendar's timezone
  duration_minutes?: number;
}

interface AvailabilityResult {
  date: string;
  timezone: string;
  duration_minutes: number;
  slots: string[]; // ISO UTC start times that are free and within business hours
  message?: string;
}

export async function findAvailableSlots(
  agentId: string,
  args: AvailabilityArgs,
): Promise<AvailabilityResult | { error: string }> {
  const cfg = await getCalendarConfig(agentId);
  if (!cfg) return { error: "Calendar not connected" };

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(args.date);
  if (!dateMatch) return { error: "Invalid date format. Use YYYY-MM-DD." };
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);

  const duration = args.duration_minutes ?? cfg.default_event_duration_minutes;
  if (duration < 5 || duration > 480) return { error: "duration_minutes must be 5–480" };

  // Determine weekday in the calendar's timezone (use noon to avoid DST edges).
  const noonUtc = zonedToUtc(year, month, day, 12, 0, cfg.timezone);
  const weekdayShort = partsInTz(noonUtc, cfg.timezone).weekday;
  const dayKey = WEEKDAY_TO_KEY[weekdayShort];
  const hours = dayKey ? cfg.business_hours[dayKey] : null;
  if (!hours || !hours.enabled) {
    return {
      date: args.date,
      timezone: cfg.timezone,
      duration_minutes: duration,
      slots: [],
      message: "Closed on this day.",
    };
  }
  const open = parseHHmm(hours.start);
  const close = parseHHmm(hours.end);
  if (!open || !close) return { error: "Invalid business hours configuration" };

  const dayStart = zonedToUtc(year, month, day, open.h, open.m, cfg.timezone);
  const dayEnd = zonedToUtc(year, month, day, close.h, close.m, cfg.timezone);

  // Don't offer slots in the past.
  const earliest = new Date(Math.max(dayStart.getTime(), Date.now() + 5 * 60_000));

  const fb = await checkFreeBusy(agentId, dayStart.toISOString(), dayEnd.toISOString());
  if ("error" in fb) return { error: fb.error };
  const busy = fb.busy.map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }));

  const slotMs = duration * 60_000;
  const stepMs = 30 * 60_000; // 30-min increments
  const bufferMs = cfg.booking_buffer_minutes * 60_000;

  const slots: string[] = [];
  // Snap earliest up to the next 30-min boundary in tz-local terms (use UTC step which works fine).
  const startTs = Math.ceil(earliest.getTime() / stepMs) * stepMs;
  for (let t = startTs; t + slotMs <= dayEnd.getTime() && slots.length < 8; t += stepMs) {
    const s = t;
    const e = t + slotMs;
    const conflicts = busy.some((b) => s < b.end + bufferMs && e + bufferMs > b.start);
    if (!conflicts) slots.push(new Date(s).toISOString());
  }

  return {
    date: args.date,
    timezone: cfg.timezone,
    duration_minutes: duration,
    slots,
  };
}

interface BookArgs {
  start_iso: string; // ISO timestamp (UTC or with offset)
  duration_minutes?: number;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  reason?: string;
}

export async function bookAppointment(params: {
  agentId: string;
  userId: string;
  conversationId: string | null;
  source?: "widget" | "manual";
  args: BookArgs;
}): Promise<
  | { ok: true; booking_id: string; start: string; end: string; event_link: string | null }
  | { error: string }
> {
  const { agentId, userId, conversationId, args } = params;
  const source = params.source ?? "widget";
  const cfg = await getCalendarConfig(agentId);
  if (!cfg) return { error: "Calendar not connected" };

  const conn = await getValidAccessToken(agentId);
  if (!conn) return { error: "Calendar not connected" };

  const start = new Date(args.start_iso);
  if (isNaN(start.getTime())) return { error: "Invalid start_iso" };
  if (start.getTime() < Date.now() - 60_000) return { error: "Cannot book a slot in the past" };

  const duration = args.duration_minutes ?? cfg.default_event_duration_minutes;
  if (duration < 5 || duration > 480) return { error: "duration_minutes must be 5–480" };
  const end = new Date(start.getTime() + duration * 60_000);

  if (!args.customer_name?.trim()) return { error: "customer_name required" };
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.customer_email || "");
  if (!emailOk) return { error: "Valid customer_email required" };

  // Re-check availability right before booking to avoid double-booking.
  const fb = await checkFreeBusy(agentId, start.toISOString(), end.toISOString());
  if ("error" in fb) return { error: fb.error };
  const bufferMs = cfg.booking_buffer_minutes * 60_000;
  const conflict = fb.busy.some((b) => {
    const bs = new Date(b.start).getTime();
    const be = new Date(b.end).getTime();
    return start.getTime() < be + bufferMs && end.getTime() + bufferMs > bs;
  });
  if (conflict) return { error: "That time was just taken — please choose another slot." };

  // Load business name for event title
  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("business_name")
    .eq("id", agentId)
    .maybeSingle();
  const businessName = agent?.business_name || "Appointment";

  const summary = `${businessName} — ${args.customer_name}`;
  const descriptionLines = [
    source === "manual" ? `Booked manually` : `Booked via website chat`,
    `Name: ${args.customer_name}`,
    `Email: ${args.customer_email}`,
  ];
  if (args.customer_phone) descriptionLines.push(`Phone: ${args.customer_phone}`);
  if (args.reason) descriptionLines.push(`Reason: ${args.reason}`);

  const ev = await createEvent(agentId, {
    summary,
    description: descriptionLines.join("\n"),
    start: start.toISOString(),
    end: end.toISOString(),
    attendeeEmail: args.customer_email,
    attendeeName: args.customer_name,
  });
  if ("error" in ev) return { error: ev.error };

  const { data: booking, error: bookErr } = await supabaseAdmin
    .from("calendar_bookings")
    .insert({
      agent_id: agentId,
      user_id: userId,
      conversation_id: conversationId,
      source: "widget",
      status: "confirmed",
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      customer_name: args.customer_name,
      customer_email: args.customer_email,
      customer_phone: args.customer_phone || null,
      reason: args.reason || null,
      google_event_id: ev.id,
    })
    .select("id")
    .single();

  if (bookErr || !booking) {
    console.error("calendar_bookings insert failed", bookErr);
    return { error: "Booking saved to calendar but failed to record. Please contact us." };
  }

  return {
    ok: true,
    booking_id: booking.id,
    start: start.toISOString(),
    end: end.toISOString(),
    event_link: ev.htmlLink || null,
  };
}

export const BOOKING_TOOLS = [
  {
    type: "function",
    function: {
      name: "find_available_slots",
      description:
        "Look up open appointment slots on a specific date. Use this BEFORE asking the visitor to pick a time. Returns ISO timestamps of free slots within business hours.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Date in YYYY-MM-DD format, interpreted in the business's timezone.",
          },
          duration_minutes: {
            type: "number",
            description: "Appointment length in minutes. Omit to use the business default.",
          },
        },
        required: ["date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description:
        "Book a confirmed appointment on the business's calendar. ONLY call after (1) the visitor has chosen a specific slot returned by find_available_slots, and (2) you have collected their full name and email. The visitor will receive a calendar invite at their email.",
      parameters: {
        type: "object",
        properties: {
          start_iso: {
            type: "string",
            description: "ISO 8601 timestamp of the chosen slot start (must be one of the slots returned earlier).",
          },
          duration_minutes: {
            type: "number",
            description: "Appointment length in minutes. Omit to use the business default.",
          },
          customer_name: { type: "string", description: "Visitor's full name." },
          customer_email: { type: "string", description: "Visitor's email address." },
          customer_phone: { type: "string", description: "Optional phone number." },
          reason: { type: "string", description: "Optional short reason for the appointment." },
        },
        required: ["start_iso", "customer_name", "customer_email"],
        additionalProperties: false,
      },
    },
  },
] as const;

export function buildBookingPromptAddendum(cfg: CalendarConfig): string {
  const today = new Date();
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: cfg.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(today);
  const weekdayName = new Intl.DateTimeFormat("en-US", {
    timeZone: cfg.timezone,
    weekday: "long",
  }).format(today);

  const hoursSummary = DAY_KEYS.map((k) => {
    const h = cfg.business_hours[k];
    return h.enabled ? `${k.slice(0, 3)} ${h.start}–${h.end}` : `${k.slice(0, 3)} closed`;
  }).join(", ");

  return [
    `BOOKING CAPABILITIES`,
    `You can book appointments directly on the business's Google Calendar using the provided tools.`,
    `Today is ${weekdayName}, ${todayStr} (${cfg.timezone}). Default appointment length: ${cfg.default_event_duration_minutes} minutes.`,
    `Business hours (${cfg.timezone}): ${hoursSummary}.`,
    ``,
    `BOOKING FLOW`,
    `1. When a visitor wants to book, ask which day works for them.`,
    `2. Call find_available_slots for that date. Present 2–4 slots in the visitor's local-friendly format (e.g. "Tue 2:30 PM"). Do NOT show ISO timestamps to the visitor.`,
    `3. Once they pick a slot, ask for their full name and email if you don't already have them.`,
    `4. Call book_appointment with the exact start_iso from find_available_slots.`,
    `5. After a successful booking, confirm the date/time in plain English and tell them they'll receive a calendar invite by email.`,
    `If a tool returns an error, apologize briefly and suggest trying another time or contacting the business directly.`,
  ].join("\n");
}

export async function isCalendarConnected(agentId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("agent_google_calendar")
    .select("id")
    .eq("agent_id", agentId)
    .maybeSingle();
  return !!data;
}
