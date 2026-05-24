ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS lead_id uuid;
CREATE INDEX IF NOT EXISTS idx_conversations_lead_id ON public.conversations(lead_id);