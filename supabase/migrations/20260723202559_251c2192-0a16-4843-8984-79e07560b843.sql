
-- Trial + billing status on profiles (data always preserved; these just gate access)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_unlimited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'active';
-- billing_status values: 'active' (normal, no gate) | 'trial' (in trial) | 'trial_expired' (trial ended, must pay) | 'past_due' | 'canceled'

-- Account invitations table
CREATE TABLE IF NOT EXISTS public.account_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  trial_days integer, -- NULL = unlimited trial
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'revoked'
  accepted_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_invitations_email_idx ON public.account_invitations (lower(email));
CREATE INDEX IF NOT EXISTS account_invitations_status_idx ON public.account_invitations (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_invitations TO authenticated;
GRANT ALL ON public.account_invitations TO service_role;

ALTER TABLE public.account_invitations ENABLE ROW LEVEL SECURITY;

-- Only admins can see or manage invitations from the client. Token-based
-- signup lookups all go through service_role (server functions).
CREATE POLICY "Admins view invitations" ON public.account_invitations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert invitations" ON public.account_invitations
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update invitations" ON public.account_invitations
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete invitations" ON public.account_invitations
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER account_invitations_updated
  BEFORE UPDATE ON public.account_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
