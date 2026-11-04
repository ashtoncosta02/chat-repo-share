CREATE OR REPLACE FUNCTION public.finalize_call_allowance(p_user uuid,p_env text,p_conversation_id text,p_seconds integer,p_reservation uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.call_allowance_ledger; v_start timestamptz; v_end timestamptz;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 IF p_env NOT IN('live','sandbox') OR p_seconds<0 THEN RAISE EXCEPTION 'Invalid call'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||p_env,0));
 SELECT * INTO v_row FROM public.call_allowance_ledger WHERE user_id=p_user AND environment=p_env AND (call_key='el:'||p_conversation_id OR id=p_reservation) ORDER BY created_at LIMIT 1;
 IF FOUND THEN
  UPDATE public.call_allowance_ledger SET actual_seconds=p_seconds,finalized_at=now() WHERE id=v_row.id;
  RETURN;
 END IF;
 SELECT current_period_start,current_period_end INTO v_start,v_end FROM public.subscriptions WHERE user_id=p_user AND environment=p_env ORDER BY created_at DESC LIMIT 1;
 v_start:=coalesce(v_start,date_trunc('month',now())); v_end:=coalesce(v_end,v_start+interval '1 month');
 INSERT INTO public.call_allowance_ledger(user_id,environment,call_key,period_start,period_end,actual_seconds,finalized_at) VALUES(p_user,p_env,'el:'||p_conversation_id,v_start,v_end,p_seconds,now()) ON CONFLICT(call_key) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.finalize_call_allowance(uuid,text,text,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_call_allowance(uuid,text,text,integer,uuid) TO service_role;