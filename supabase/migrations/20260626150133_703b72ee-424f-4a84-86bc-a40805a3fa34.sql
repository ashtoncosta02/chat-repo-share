CREATE TABLE public.password_reset_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.password_reset_tokens TO service_role;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
CREATE INDEX password_reset_tokens_email_idx ON public.password_reset_tokens (email);
CREATE INDEX password_reset_tokens_expires_idx ON public.password_reset_tokens (expires_at);