CREATE OR REPLACE FUNCTION public.account_plan_id(p_user uuid, p_env text DEFAULT 'live') RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_price text;
BEGIN
 IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 IF p_env NOT IN ('live','sandbox') THEN RAISE EXCEPTION 'Invalid environment'; END IF;
 SELECT price_id INTO v_price FROM public.subscriptions WHERE user_id=p_user AND environment=p_env AND ((status IN ('active','trialing','past_due') AND (current_period_end IS NULL OR current_period_end>now())) OR (status='canceled' AND current_period_end>now())) ORDER BY created_at DESC LIMIT 1;
 IF v_price IN ('essential_monthly','elite_monthly') THEN RETURN v_price; END IF;
 IF v_price IS NOT NULL THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_user AND role='admin') OR EXISTS(SELECT 1 FROM public.profiles WHERE user_id=p_user AND (trial_unlimited OR (billing_status='trial' AND (trial_ends_at IS NULL OR trial_ends_at>now())))) THEN RETURN 'elite_monthly'; END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.account_plan_id(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.account_plan_id(uuid,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.enforce_scenario_plan() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_plan text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.scenarios IS NOT DISTINCT FROM OLD.scenarios AND NEW.user_id=OLD.user_id THEN RETURN NEW; END IF;
 IF NEW.scenarios IS NULL OR NEW.scenarios='[]'::jsonb THEN RETURN NEW; END IF;
 IF jsonb_typeof(NEW.scenarios)<>'array' THEN RAISE EXCEPTION 'Scenarios must be a list'; END IF;
 -- Server writes also obey plan limits; live subscriptions take precedence for a shared account.
 v_plan := public.account_plan_id(NEW.user_id,'live');
 IF v_plan IS NULL THEN v_plan := public.account_plan_id(NEW.user_id,'sandbox'); END IF;
 IF v_plan IS NULL THEN RAISE EXCEPTION 'Select an active plan before saving scenarios'; END IF;
 IF v_plan='essential_monthly' THEN
  IF jsonb_array_length(NEW.scenarios)>3 THEN RAISE EXCEPTION 'Essential includes up to 3 scenarios. Choose Elite for more.'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.scenarios) s WHERE s->'action'->>'type'='call_transfer') THEN RAISE EXCEPTION 'Instant human transfer is available on Elite only.'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_scenario_plan() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER enforce_scenario_plan BEFORE INSERT OR UPDATE OF scenarios,user_id ON public.agents FOR EACH ROW EXECUTE FUNCTION public.enforce_scenario_plan();

CREATE TABLE public.call_allowance_ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 environment text NOT NULL CHECK(environment IN ('live','sandbox')),
 call_key text NOT NULL UNIQUE,
 period_start timestamptz NOT NULL,
 period_end timestamptz NOT NULL,
 reserved_seconds integer NOT NULL DEFAULT 0 CHECK(reserved_seconds>=0),
 actual_seconds integer CHECK(actual_seconds>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 finalized_at timestamptz
);
GRANT SELECT ON public.call_allowance_ledger TO authenticated;
GRANT ALL ON public.call_allowance_ledger TO service_role;
ALTER TABLE public.call_allowance_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY call_allowance_owner_read ON public.call_allowance_ledger FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE INDEX call_allowance_period_idx ON public.call_allowance_ledger(user_id,environment,period_start);
-- Preserve already-used call time independently of deletable conversation history.
INSERT INTO public.call_allowance_ledger(user_id,environment,call_key,period_start,period_end,reserved_seconds,actual_seconds,finalized_at)
SELECT c.user_id,'live','el:'||c.elevenlabs_conversation_id,coalesce(s.current_period_start,date_trunc('month',c.started_at)),coalesce(s.current_period_end,date_trunc('month',c.started_at)+interval '1 month'),0,greatest(coalesce(c.duration_seconds,0),0),now()
FROM public.conversations c LEFT JOIN LATERAL(SELECT current_period_start,current_period_end FROM public.subscriptions WHERE user_id=c.user_id AND environment='live' AND c.started_at>=current_period_start AND c.started_at<current_period_end ORDER BY created_at DESC LIMIT 1)s ON true
WHERE c.elevenlabs_conversation_id IS NOT NULL ON CONFLICT(call_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.reserve_call_allowance(p_user uuid,p_env text,p_call_key text,p_max_seconds integer DEFAULT 600) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_plan text; v_start timestamptz; v_end timestamptz; v_cap integer; v_used bigint; v_seconds integer; v_existing public.call_allowance_ledger;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 IF p_max_seconds<1 OR p_max_seconds>7200 THEN RAISE EXCEPTION 'Invalid call duration'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||p_env,0));
 SELECT * INTO v_existing FROM public.call_allowance_ledger WHERE call_key=p_call_key;
 IF FOUND THEN
  IF v_existing.user_id<>p_user OR v_existing.environment<>p_env THEN RAISE EXCEPTION 'Call identity mismatch'; END IF;
  RETURN jsonb_build_object('seconds',CASE WHEN v_existing.finalized_at IS NULL THEN v_existing.reserved_seconds ELSE 0 END,'reservation_id',v_existing.id);
 END IF;
 v_plan:=public.account_plan_id(p_user,p_env);
 IF v_plan IS NULL THEN RETURN jsonb_build_object('seconds',0,'error','Your receptionist is paused. Choose an active plan.'); END IF;
 v_cap:=CASE WHEN v_plan='essential_monthly' THEN 12000 ELSE 45000 END;
 SELECT current_period_start,current_period_end INTO v_start,v_end FROM public.subscriptions WHERE user_id=p_user AND environment=p_env AND ((status IN('active','trialing','past_due') AND (current_period_end IS NULL OR current_period_end>now())) OR(status='canceled' AND current_period_end>now())) ORDER BY created_at DESC LIMIT 1;
 v_start:=coalesce(v_start,date_trunc('month',now())); v_end:=coalesce(v_end,v_start+interval '1 month');
 SELECT coalesce(sum(coalesce(actual_seconds,reserved_seconds)),0) INTO v_used FROM public.call_allowance_ledger WHERE user_id=p_user AND environment=p_env AND period_start=v_start;
 v_seconds:=least(p_max_seconds,greatest(0,v_cap-v_used)::integer);
 IF v_seconds=0 THEN RETURN jsonb_build_object('seconds',0,'error','Monthly call allowance reached. Calls resume at your next billing period.'); END IF;
 INSERT INTO public.call_allowance_ledger(user_id,environment,call_key,period_start,period_end,reserved_seconds) VALUES(p_user,p_env,p_call_key,v_start,v_end,v_seconds) RETURNING * INTO v_existing;
 RETURN jsonb_build_object('seconds',v_seconds,'reservation_id',v_existing.id,'plan_id',v_plan);
END $$;
REVOKE ALL ON FUNCTION public.reserve_call_allowance(uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_call_allowance(uuid,text,text,integer) TO service_role;