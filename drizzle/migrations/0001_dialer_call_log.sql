CREATE TABLE public.dialer_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  to_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.dialer_calls TO service_role;
ALTER TABLE public.dialer_calls ENABLE ROW LEVEL SECURITY;
CREATE INDEX dialer_calls_user_created_idx ON public.dialer_calls (user_id, created_at DESC);