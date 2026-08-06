CREATE TABLE public.webhook_failures (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL DEFAULT 'elevenlabs_postcall',
  reason text NOT NULL,
  elevenlabs_conversation_id text,
  elevenlabs_agent_id text,
  payload jsonb NOT NULL,
  replayed_at timestamp with time zone,
  replay_result text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_failures_pending ON public.webhook_failures (created_at DESC) WHERE replayed_at IS NULL;
CREATE UNIQUE INDEX idx_webhook_failures_conv ON public.webhook_failures (source, elevenlabs_conversation_id) WHERE elevenlabs_conversation_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_failures TO authenticated;
GRANT ALL ON public.webhook_failures TO service_role;

ALTER TABLE public.webhook_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook failures"
ON public.webhook_failures FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update webhook failures"
ON public.webhook_failures FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete webhook failures"
ON public.webhook_failures FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));