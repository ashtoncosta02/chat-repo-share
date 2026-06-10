
-- Convert any existing public-URL recording_url entries to the underlying storage path.
-- Public URL pattern: .../storage/v1/object/public/call-audio/<path>
UPDATE public.conversations
SET recording_url = regexp_replace(recording_url, '^.*?/storage/v1/object/public/call-audio/', '')
WHERE recording_url LIKE '%/storage/v1/object/public/call-audio/%';

-- Allow each user to read their own files in the now-private call-audio bucket.
-- Path convention: <user_id>/<conversation_id>.<ext>
DROP POLICY IF EXISTS "Owners can read their call recordings" ON storage.objects;
CREATE POLICY "Owners can read their call recordings"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'call-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
