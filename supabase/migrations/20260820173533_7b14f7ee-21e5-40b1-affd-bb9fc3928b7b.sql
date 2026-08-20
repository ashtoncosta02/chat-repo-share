DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND plan IS NOT DISTINCT FROM (SELECT p.plan FROM public.profiles p WHERE p.user_id = auth.uid())
  AND trial_unlimited IS NOT DISTINCT FROM (SELECT p.trial_unlimited FROM public.profiles p WHERE p.user_id = auth.uid())
  AND billing_status IS NOT DISTINCT FROM (SELECT p.billing_status FROM public.profiles p WHERE p.user_id = auth.uid())
  AND monthly_price_override_cents IS NOT DISTINCT FROM (SELECT p.monthly_price_override_cents FROM public.profiles p WHERE p.user_id = auth.uid())
  AND first_month_free_until IS NOT DISTINCT FROM (SELECT p.first_month_free_until FROM public.profiles p WHERE p.user_id = auth.uid())
  AND trial_ends_at IS NOT DISTINCT FROM (SELECT p.trial_ends_at FROM public.profiles p WHERE p.user_id = auth.uid())
);