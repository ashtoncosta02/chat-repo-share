ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS recording_url TEXT;