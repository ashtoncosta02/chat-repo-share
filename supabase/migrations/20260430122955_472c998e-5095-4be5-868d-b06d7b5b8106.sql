-- Clean up your two test agents (and their dependent data) before enforcing 1-per-user
DELETE FROM public.calendar_bookings WHERE user_id = '481c759d-a7cf-4548-a2a4-c5b465286d29';
DELETE FROM public.leads WHERE user_id = '481c759d-a7cf-4548-a2a4-c5b465286d29';
DELETE FROM public.messages WHERE user_id = '481c759d-a7cf-4548-a2a4-c5b465286d29';
DELETE FROM public.widget_messages WHERE conversation_id IN (SELECT id FROM public.widget_conversations WHERE user_id = '481c759d-a7cf-4548-a2a4-c5b465286d29');
DELETE FROM public.widget_conversations WHERE user_id = '481c759d-a7cf-4548-a2a4-c5b465286d29';
DELETE FROM public.conversations WHERE user_id = '481c759d-a7cf-4548-a2a4-c5b465286d29';
DELETE FROM public.agent_google_calendar WHERE user_id = '481c759d-a7cf-4548-a2a4-c5b465286d29';
UPDATE public.phone_numbers SET agent_id = NULL WHERE user_id = '481c759d-a7cf-4548-a2a4-c5b465286d29';
DELETE FROM public.agents WHERE user_id = '481c759d-a7cf-4548-a2a4-c5b465286d29';

-- Schema additions
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS sms_followup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS faqs_structured jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Backfill: any existing agent on other accounts is considered already onboarded
UPDATE public.agents SET onboarding_completed = true WHERE onboarding_completed = false;

-- Enforce 1-agent-per-user limit at the DB level
CREATE UNIQUE INDEX IF NOT EXISTS agents_one_per_user_idx ON public.agents (user_id);