ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS greeting_message TEXT,
  ADD COLUMN IF NOT EXISTS farewell_message TEXT;