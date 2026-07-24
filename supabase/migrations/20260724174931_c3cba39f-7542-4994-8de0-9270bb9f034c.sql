
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'voice',
  ADD COLUMN IF NOT EXISTS widget_conversation_id uuid UNIQUE REFERENCES public.widget_conversations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_conversations_widget ON public.conversations(widget_conversation_id);

ALTER TABLE public.widget_conversations
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;
