DROP POLICY IF EXISTS "owners insert own feedback" ON public.agent_feedback;
CREATE POLICY "owners insert own feedback" ON public.agent_feedback
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND a.user_id = auth.uid())
  );