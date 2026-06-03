ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS notify_email_transcript boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_sms_transcript boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_email text,
  ADD COLUMN IF NOT EXISTS notify_phone text;