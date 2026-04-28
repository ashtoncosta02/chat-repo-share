CREATE TABLE public.agent_google_calendar (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  google_email text NOT NULL,
  google_user_id text,
  calendar_id text NOT NULL DEFAULT 'primary',
  calendar_name text,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamp with time zone NOT NULL,
  scope text,
  default_event_duration_minutes integer NOT NULL DEFAULT 30,
  timezone text NOT NULL DEFAULT 'America/New_York',
  business_hours jsonb NOT NULL DEFAULT '{
    "monday":    {"enabled": true,  "start": "09:00", "end": "17:00"},
    "tuesday":   {"enabled": true,  "start": "09:00", "end": "17:00"},
    "wednesday": {"enabled": true,  "start": "09:00", "end": "17:00"},
    "thursday":  {"enabled": true,  "start": "09:00", "end": "17:00"},
    "friday":    {"enabled": true,  "start": "09:00", "end": "17:00"},
    "saturday":  {"enabled": false, "start": "09:00", "end": "17:00"},
    "sunday":    {"enabled": false, "start": "09:00", "end": "17:00"}
  }'::jsonb,
  booking_buffer_minutes integer NOT NULL DEFAULT 15,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_google_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view calendar connections"
  ON public.agent_google_calendar
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owners insert calendar connections"
  ON public.agent_google_calendar
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners update calendar connections"
  ON public.agent_google_calendar
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owners delete calendar connections"
  ON public.agent_google_calendar
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_agent_google_calendar_updated_at
  BEFORE UPDATE ON public.agent_google_calendar
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_agent_google_calendar_user_id ON public.agent_google_calendar(user_id);
CREATE INDEX idx_agent_google_calendar_agent_id ON public.agent_google_calendar(agent_id);

CREATE TABLE public.calendar_bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL,
  user_id uuid NOT NULL,
  google_event_id text,
  customer_name text,
  customer_email text,
  customer_phone text,
  reason text,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  source text NOT NULL DEFAULT 'widget',
  conversation_id uuid,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view bookings"
  ON public.calendar_bookings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owners update bookings"
  ON public.calendar_bookings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owners delete bookings"
  ON public.calendar_bookings
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_calendar_bookings_updated_at
  BEFORE UPDATE ON public.calendar_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_calendar_bookings_user_id ON public.calendar_bookings(user_id);
CREATE INDEX idx_calendar_bookings_agent_id ON public.calendar_bookings(agent_id);
CREATE INDEX idx_calendar_bookings_starts_at ON public.calendar_bookings(starts_at);