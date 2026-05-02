-- Allow owners to delete their own messages
CREATE POLICY "Users delete own messages"
  ON public.messages
  FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-delete messages when their conversation is deleted
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_conversation_id_fkey
  FOREIGN KEY (conversation_id)
  REFERENCES public.conversations(id)
  ON DELETE CASCADE;