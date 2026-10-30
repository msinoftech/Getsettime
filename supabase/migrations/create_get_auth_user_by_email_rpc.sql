-- Fast indexed auth user lookup by email (service role only).
-- Used by Google OAuth and registration flows instead of auth.admin.listUsers.
--
-- Safety notes (verified against existing migrations):
-- - Does NOT alter tables, views, RLS policies, or triggers.
-- - Does NOT conflict with existing functions (unique name/signature).
-- - Read-only SELECT on auth.users; same data already returned by auth.admin.listUsers.
-- - EXECUTE granted only to service_role (server-side API routes), not anon/authenticated.
-- - Follows insert_booking_if_capacity revoke/grant pattern in add_booking_series_and_step_order.sql.

CREATE OR REPLACE FUNCTION public.get_auth_user_by_email(lookup_email text)
RETURNS TABLE (
  id uuid,
  email text,
  email_confirmed_at timestamptz,
  user_metadata jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT
    u.id,
    u.email,
    u.email_confirmed_at,
    u.raw_user_meta_data
  FROM auth.users u
  WHERE lookup_email IS NOT NULL
    AND trim(lookup_email) <> ''
    AND lower(trim(u.email)) = lower(trim(lookup_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_auth_user_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_auth_user_by_email(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_auth_user_by_email(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_by_email(text) TO service_role;

COMMENT ON FUNCTION public.get_auth_user_by_email(text) IS
  'Server-side auth email lookup. service_role only. Returns at most one auth.users row.';
