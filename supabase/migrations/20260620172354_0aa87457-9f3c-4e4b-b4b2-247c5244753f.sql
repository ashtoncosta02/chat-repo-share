CREATE TABLE public.admin_impersonation_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_impersonation_log TO authenticated;
GRANT ALL ON public.admin_impersonation_log TO service_role;
ALTER TABLE public.admin_impersonation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view impersonation log"
  ON public.admin_impersonation_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_impersonation_log_admin ON public.admin_impersonation_log(admin_user_id, created_at DESC);
CREATE INDEX idx_impersonation_log_target ON public.admin_impersonation_log(target_user_id, created_at DESC);