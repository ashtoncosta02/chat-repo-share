
-- 1. Drop overly permissive public storage policy for call recordings.
--    Audio is now stored under <userId>/<convId>.<ext> and accessed via signed URLs.
DROP POLICY IF EXISTS "Public can fetch call-audio mp3 by exact path" ON storage.objects;

-- 2. Lock down SECURITY DEFINER pgmq wrappers: pin search_path and revoke EXECUTE
--    from public roles. Only the service role (used by the email queue processor)
--    should call these.
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

-- 3. voice_audio_cache: service-role-only by design. Revoke Data API access from
--    anon/authenticated to make intent explicit and prevent silent failures from
--    being mistaken for permission gaps.
REVOKE ALL ON public.voice_audio_cache FROM anon, authenticated;
GRANT ALL ON public.voice_audio_cache TO service_role;

-- 4. widget_messages: writes happen via the service role from the public widget
--    chat route. Add explicit deny-INSERT policies for anon/authenticated so
--    signed-in users cannot inject messages into other users' conversations
--    via the Data API.
CREATE POLICY "Deny direct inserts from anon"
  ON public.widget_messages
  FOR INSERT
  TO anon
  WITH CHECK (false);

CREATE POLICY "Deny direct inserts from authenticated"
  ON public.widget_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (false);
