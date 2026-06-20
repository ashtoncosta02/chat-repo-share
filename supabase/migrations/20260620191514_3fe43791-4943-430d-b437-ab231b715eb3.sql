UPDATE public.conversations c
SET ai_summary = 'Caller hung up without speaking.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.messages m
  WHERE m.conversation_id = c.id AND m.role = 'user'
);