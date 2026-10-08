CREATE TABLE public.deleted_voice_calls (
  elevenlabs_conversation_id text PRIMARY KEY,
  user_id uuid NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.deleted_voice_calls TO service_role;
ALTER TABLE public.deleted_voice_calls ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_deleted_voice_call()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.elevenlabs_conversation_id IS NOT NULL THEN
    INSERT INTO public.deleted_voice_calls (elevenlabs_conversation_id, user_id)
    VALUES (OLD.elevenlabs_conversation_id, OLD.user_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN OLD;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_deleted_voice_call() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER conversations_record_deleted_voice_call
AFTER DELETE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.record_deleted_voice_call();