-- Conversations created by visitors on a client's site through the embeddable widget
CREATE TABLE public.widget_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- denormalized: owner of the agent, for fast RLS
  session_token TEXT NOT NULL, -- random token from the visitor's browser to scope their conversation
  visitor_name TEXT,
  visitor_email TEXT,
  page_url TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_widget_conversations_agent ON public.widget_conversations(agent_id);
CREATE INDEX idx_widget_conversations_user ON public.widget_conversations(user_id);
CREATE INDEX idx_widget_conversations_session ON public.widget_conversations(session_token);

CREATE TABLE public.widget_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.widget_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_widget_messages_conversation ON public.widget_messages(conversation_id);

ALTER TABLE public.widget_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_messages ENABLE ROW LEVEL SECURITY;

-- Owner-only read/update/delete for widget_conversations
CREATE POLICY "Owners view widget conversations"
  ON public.widget_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owners update widget conversations"
  ON public.widget_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owners delete widget conversations"
  ON public.widget_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Owner-only read for widget_messages
CREATE POLICY "Owners view widget messages"
  ON public.widget_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.widget_conversations c
      WHERE c.id = widget_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

-- NOTE: Public inserts (from the embedded widget on client sites) happen via
-- server routes using the service-role admin client, so no anon INSERT policy
-- is needed. RLS still blocks direct anon writes from the browser.

CREATE TRIGGER trg_widget_conversations_updated_at
  BEFORE UPDATE ON public.widget_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();