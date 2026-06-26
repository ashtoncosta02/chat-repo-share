
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS conversations_archived_at_idx ON public.conversations (archived_at);

CREATE TABLE IF NOT EXISTS public.blocked_callers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent_id uuid,
  phone text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_callers TO authenticated;
GRANT ALL ON public.blocked_callers TO service_role;
ALTER TABLE public.blocked_callers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own blocked callers"
  ON public.blocked_callers
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS blocked_callers_user_phone_idx ON public.blocked_callers (user_id, phone);
