
CREATE TABLE public.agent_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  rating text NOT NULL CHECK (rating IN ('up','down')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX agent_feedback_agent_created_idx ON public.agent_feedback(agent_id, created_at DESC);
CREATE INDEX agent_feedback_conversation_idx ON public.agent_feedback(conversation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_feedback TO authenticated;
GRANT ALL ON public.agent_feedback TO service_role;

ALTER TABLE public.agent_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view own feedback" ON public.agent_feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owners insert own feedback" ON public.agent_feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owners delete own feedback" ON public.agent_feedback
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
