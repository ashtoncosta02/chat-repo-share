
-- handle_new_user is invoked by an auth.users trigger; it never needs direct callers.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role, supabase_auth_admin;

-- has_role is called inside RLS policies that target authenticated users, so it
-- must remain executable by authenticated. Revoke anon/public; anon never hits
-- those policies.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
