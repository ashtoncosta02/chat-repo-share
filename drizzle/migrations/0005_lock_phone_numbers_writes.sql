DROP POLICY IF EXISTS "Users insert own phone numbers" ON public.phone_numbers;
DROP POLICY IF EXISTS "Users update own phone numbers" ON public.phone_numbers;
DROP POLICY IF EXISTS "Users delete own phone numbers" ON public.phone_numbers;
REVOKE INSERT, UPDATE, DELETE ON public.phone_numbers FROM anon, authenticated;
GRANT SELECT ON public.phone_numbers TO authenticated;
GRANT ALL ON public.phone_numbers TO service_role;