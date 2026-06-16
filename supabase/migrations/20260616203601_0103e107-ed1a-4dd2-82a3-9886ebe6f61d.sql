
-- Plan column on profiles
DO $$ BEGIN
  CREATE TYPE public.user_plan AS ENUM ('free', 'discounted', 'standard');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan public.user_plan NOT NULL DEFAULT 'standard';

-- Tickets
DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'waiting', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority public.ticket_priority NOT NULL DEFAULT 'normal',
  category TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tickets" ON public.tickets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own tickets" ON public.tickets
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins update tickets" ON public.tickets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete tickets" ON public.tickets
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS tickets_status_idx ON public.tickets(status);
CREATE INDEX IF NOT EXISTS tickets_user_id_idx ON public.tickets(user_id);

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ticket messages
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'admin')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View messages on accessible tickets" ON public.ticket_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (t.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Send messages on accessible tickets" ON public.ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (t.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE INDEX IF NOT EXISTS ticket_messages_ticket_idx ON public.ticket_messages(ticket_id, created_at);
