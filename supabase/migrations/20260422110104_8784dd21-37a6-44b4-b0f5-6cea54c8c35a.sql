CREATE TABLE public.phone_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  twilio_sid TEXT NOT NULL UNIQUE,
  phone_number TEXT NOT NULL UNIQUE,
  friendly_name TEXT,
  country TEXT NOT NULL DEFAULT 'US',
  region TEXT,
  locality TEXT,
  postal_code TEXT,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  monthly_price NUMERIC(10,4),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_phone_numbers_user_id ON public.phone_numbers(user_id);
CREATE INDEX idx_phone_numbers_agent_id ON public.phone_numbers(agent_id);

ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own phone numbers"
ON public.phone_numbers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own phone numbers"
ON public.phone_numbers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own phone numbers"
ON public.phone_numbers FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own phone numbers"
ON public.phone_numbers FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_phone_numbers_updated_at
BEFORE UPDATE ON public.phone_numbers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();