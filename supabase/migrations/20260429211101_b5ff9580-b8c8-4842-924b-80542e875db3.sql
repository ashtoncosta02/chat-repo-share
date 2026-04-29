ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS widget_color TEXT,
  ADD COLUMN IF NOT EXISTS widget_greeting TEXT,
  ADD COLUMN IF NOT EXISTS widget_position TEXT NOT NULL DEFAULT 'bottom-right';

DO $$ BEGIN
  ALTER TABLE public.agents DROP CONSTRAINT IF EXISTS agents_widget_position_check;
  ALTER TABLE public.agents ADD CONSTRAINT agents_widget_position_check
    CHECK (widget_position IN ('bottom-right','bottom-left'));
END $$;