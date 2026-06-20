CREATE TABLE public.dashboard_test_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  elevenlabs_conversation_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.dashboard_test_conversations TO authenticated;
GRANT ALL ON public.dashboard_test_conversations TO service_role;

ALTER TABLE public.dashboard_test_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own test markers"
ON public.dashboard_test_conversations
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own test markers"
ON public.dashboard_test_conversations
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_dashboard_test_conversations_el_id
  ON public.dashboard_test_conversations (elevenlabs_conversation_id);