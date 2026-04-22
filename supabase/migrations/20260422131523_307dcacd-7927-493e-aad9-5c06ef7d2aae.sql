
-- Replace the broad SELECT policy with one that still allows direct
-- object fetches by URL (Twilio needs this to play the MP3) but does
-- NOT let anyone enumerate the bucket contents.
--
-- The Supabase storage list API requires a SELECT policy on the bucket
-- itself in storage.buckets to enumerate objects; by leaving that off,
-- direct GETs of /object/public/call-audio/<path> still work, but
-- /object/list/call-audio is denied.
--
-- We also restrict to objects whose names look like our generated
-- pattern (uuid-prefixed mp3) so a leaked URL can't be used to host
-- arbitrary content.
DROP POLICY IF EXISTS "Public read access to call-audio" ON storage.objects;
CREATE POLICY "Public can fetch call-audio mp3 by exact path"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'call-audio'
  AND name ~ '^[a-z0-9-]+\.mp3$'
);
