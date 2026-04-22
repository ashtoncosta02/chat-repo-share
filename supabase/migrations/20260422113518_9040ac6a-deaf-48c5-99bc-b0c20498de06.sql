-- Add answer_mode setting to agents (controls voice behavior, will be used when voice is wired)
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS answer_mode TEXT NOT NULL DEFAULT 'immediate';

-- Constrain to known values
ALTER TABLE public.agents
  DROP CONSTRAINT IF EXISTS agents_answer_mode_check;
ALTER TABLE public.agents
  ADD CONSTRAINT agents_answer_mode_check
  CHECK (answer_mode IN ('immediate', 'after_4_rings'));

-- Allow the public webhook to look up phone_numbers and agents by To number
-- (RLS already restricts client access; webhook uses service role and bypasses RLS)
CREATE INDEX IF NOT EXISTS idx_phone_numbers_phone_number
  ON public.phone_numbers (phone_number);