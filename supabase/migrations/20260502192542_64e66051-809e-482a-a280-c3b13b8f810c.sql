ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS elevenlabs_find_slots_tool_id text,
  ADD COLUMN IF NOT EXISTS elevenlabs_book_tool_id text;