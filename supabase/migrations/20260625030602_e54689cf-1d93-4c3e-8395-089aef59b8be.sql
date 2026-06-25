ALTER TABLE public.agent_outlook_calendar
  RENAME COLUMN selected_calendar_id TO calendar_id;
ALTER TABLE public.agent_outlook_calendar
  RENAME COLUMN selected_calendar_name TO calendar_name;
ALTER TABLE public.agent_outlook_calendar
  RENAME COLUMN slot_duration_minutes TO default_event_duration_minutes;
ALTER TABLE public.agent_outlook_calendar
  RENAME COLUMN buffer_minutes TO booking_buffer_minutes;

ALTER TABLE public.agent_outlook_calendar
  ALTER COLUMN calendar_id SET DEFAULT 'primary';

UPDATE public.agent_outlook_calendar SET calendar_id = 'primary' WHERE calendar_id IS NULL;

ALTER TABLE public.agent_outlook_calendar
  ALTER COLUMN calendar_id SET NOT NULL;

-- Normalize business hours to the full-name keys used by Google calendar
ALTER TABLE public.agent_outlook_calendar
  ALTER COLUMN business_hours SET DEFAULT '{"sunday":{"enabled":false,"start":"09:00","end":"17:00"},"monday":{"enabled":true,"start":"09:00","end":"17:00"},"tuesday":{"enabled":true,"start":"09:00","end":"17:00"},"wednesday":{"enabled":true,"start":"09:00","end":"17:00"},"thursday":{"enabled":true,"start":"09:00","end":"17:00"},"friday":{"enabled":true,"start":"09:00","end":"17:00"},"saturday":{"enabled":false,"start":"09:00","end":"17:00"}}'::jsonb;

-- Also add google_event_id columns equivalents are already present on calendar_bookings.
-- Add outlook_event_id + outlook_event_link to calendar_bookings.
ALTER TABLE public.calendar_bookings
  ADD COLUMN IF NOT EXISTS outlook_event_id TEXT,
  ADD COLUMN IF NOT EXISTS outlook_event_link TEXT;