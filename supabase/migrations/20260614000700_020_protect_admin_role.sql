/* Prevent authenticated users from assigning themselves administrative access. */

-- Profile rows are created by the SECURITY DEFINER auth trigger. Browser clients
-- may edit presentation fields only; is_admin remains service-role controlled.
REVOKE INSERT, UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (display_name, avatar_url) ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS "users_insert_own_profile" ON public.profiles;

