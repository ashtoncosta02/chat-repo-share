CREATE OR REPLACE FUNCTION public.protect_profile_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / internal backend code and admins may change billing fields.
  IF current_setting('role', true) = 'service_role'
     OR auth.role() = 'service_role'
     OR auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  NEW.plan := OLD.plan;
  NEW.billing_status := OLD.billing_status;
  NEW.trial_unlimited := OLD.trial_unlimited;
  NEW.trial_ends_at := OLD.trial_ends_at;
  NEW.monthly_price_override_cents := OLD.monthly_price_override_cents;
  NEW.first_month_free_until := OLD.first_month_free_until;
  NEW.user_id := OLD.user_id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_profile_billing_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_protect_billing ON public.profiles;
CREATE TRIGGER profiles_protect_billing
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_billing_fields();

-- Also prevent self-provisioned billing state at insert time.
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND plan = 'free'::user_plan
  AND trial_unlimited = false
  AND monthly_price_override_cents IS NULL
  AND first_month_free_until IS NULL
  AND trial_ends_at IS NULL
);