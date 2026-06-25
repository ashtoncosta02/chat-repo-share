-- 1. agent_outlook_calendar table (mirrors agent_google_calendar)
CREATE TABLE public.agent_outlook_calendar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  microsoft_account_email TEXT,
  microsoft_account_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  selected_calendar_id TEXT,
  selected_calendar_name TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  business_hours JSONB NOT NULL DEFAULT '{"mon":{"start":"09:00","end":"17:00","enabled":true},"tue":{"start":"09:00","end":"17:00","enabled":true},"wed":{"start":"09:00","end":"17:00","enabled":true},"thu":{"start":"09:00","end":"17:00","enabled":true},"fri":{"start":"09:00","end":"17:00","enabled":true},"sat":{"start":"09:00","end":"17:00","enabled":false},"sun":{"start":"09:00","end":"17:00","enabled":false}}'::jsonb,
  slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
  buffer_minutes INTEGER NOT NULL DEFAULT 0,
  last_refresh_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_outlook_calendar TO authenticated;
GRANT ALL ON public.agent_outlook_calendar TO service_role;

ALTER TABLE public.agent_outlook_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own outlook connection"
ON public.agent_outlook_calendar FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own outlook connection"
ON public.agent_outlook_calendar FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own outlook connection"
ON public.agent_outlook_calendar FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own outlook connection"
ON public.agent_outlook_calendar FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_agent_outlook_calendar_updated_at
BEFORE UPDATE ON public.agent_outlook_calendar
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_agent_outlook_calendar_agent_id ON public.agent_outlook_calendar(agent_id);
CREATE INDEX idx_agent_outlook_calendar_user_id ON public.agent_outlook_calendar(user_id);

-- 2. Add provider column to calendar_bookings
ALTER TABLE public.calendar_bookings
ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'google';

-- Backfill existing rows (already google)
UPDATE public.calendar_bookings SET provider = 'google' WHERE provider IS NULL;