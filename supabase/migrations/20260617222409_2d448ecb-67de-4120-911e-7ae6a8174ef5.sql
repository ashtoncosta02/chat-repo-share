ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_price_override_cents integer,
  ADD COLUMN IF NOT EXISTS first_month_free_until timestamptz;