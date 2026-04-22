
-- Create a public storage bucket for short-lived TTS audio clips that
-- Twilio fetches to play to phone callers. Files in this bucket are
-- replaced quickly and an external cron job deletes anything older than
-- 24 hours, so caller-facing audio never accumulates indefinitely.
INSERT INTO storage.buckets (id, name, public)
VALUES ('call-audio', 'call-audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Anyone (including Twilio's media fetcher and unauthenticated browsers)
-- can read objects in this bucket. The bucket only ever holds ephemeral
-- agent-generated speech, never user PII.
DROP POLICY IF EXISTS "Public read access to call-audio" ON storage.objects;
CREATE POLICY "Public read access to call-audio"
ON storage.objects
FOR SELECT
USING (bucket_id = 'call-audio');

-- Only the service role (used by our server routes) may write or delete
-- audio clips. End-user clients never touch this bucket directly.
DROP POLICY IF EXISTS "Service role can manage call-audio" ON storage.objects;
CREATE POLICY "Service role can manage call-audio"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'call-audio')
WITH CHECK (bucket_id = 'call-audio');
