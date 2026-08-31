
-- 1. Scope security-definer helpers to the caller (or admins)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND _user_id IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles
       WHERE user_id = auth.uid() AND role = 'admin'::app_role
     ) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid uuid, check_env text DEFAULT 'live'::text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND user_uuid IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles
       WHERE user_id = auth.uid() AND role = 'admin'::app_role
     ) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = user_uuid
      AND environment = check_env
      AND (
        (status IN ('active','trialing','past_due') AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  );
END;
$$;

-- 2. ticket_messages: derive sender_role server-side
CREATE OR REPLACE FUNCTION public.set_ticket_message_sender_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- service role / backend
  END IF;
  NEW.sender_id := auth.uid();
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::app_role) THEN
    NEW.sender_role := 'admin';
  ELSE
    NEW.sender_role := 'customer';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ticket_messages_set_sender_role ON public.ticket_messages;
CREATE TRIGGER ticket_messages_set_sender_role
BEFORE INSERT ON public.ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.set_ticket_message_sender_role();

-- 3. calendar_bookings: allow owners to insert their own bookings
DROP POLICY IF EXISTS "Owners insert bookings" ON public.calendar_bookings;
CREATE POLICY "Owners insert bookings"
ON public.calendar_bookings FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
GRANT INSERT ON public.calendar_bookings TO authenticated;

-- 4. profiles: explicit admin read policy
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. user_roles: block self-escalation / self-modification
DROP POLICY IF EXISTS "Admins insert roles" ON public.user_roles;
CREATE POLICY "Admins insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND user_id <> auth.uid());

DROP POLICY IF EXISTS "Admins update roles" ON public.user_roles;
CREATE POLICY "Admins update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) AND user_id <> auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND user_id <> auth.uid());

DROP POLICY IF EXISTS "Admins delete roles" ON public.user_roles;
CREATE POLICY "Admins delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) AND user_id <> auth.uid());

-- 6. voice_audio_cache: explicit service-role-only policy
ALTER TABLE public.voice_audio_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages voice audio cache" ON public.voice_audio_cache;
CREATE POLICY "Service role manages voice audio cache"
ON public.voice_audio_cache FOR ALL TO service_role
USING (true) WITH CHECK (true);
REVOKE ALL ON public.voice_audio_cache FROM anon, authenticated;
GRANT ALL ON public.voice_audio_cache TO service_role;
