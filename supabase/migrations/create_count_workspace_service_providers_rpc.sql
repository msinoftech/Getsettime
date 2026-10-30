-- Fast service-provider count for a workspace (service role only).
-- Replaces auth.admin.listUsers pagination in subscription usage checks.

CREATE OR REPLACE FUNCTION public.count_workspace_service_providers(p_workspace_id bigint)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT COUNT(*)::integer
  FROM auth.users u
  WHERE p_workspace_id IS NOT NULL
    AND p_workspace_id > 0
    AND COALESCE(u.raw_user_meta_data->>'deactivated', 'false') <> 'true'
    AND (
      (u.raw_user_meta_data->>'workspace_id')::bigint = p_workspace_id
      OR (u.raw_user_meta_data->'workspace_id')::bigint = p_workspace_id
    )
    AND (
      u.raw_user_meta_data->>'role' = 'service_provider'
      OR (
        COALESCE((u.raw_user_meta_data->>'is_workspace_owner')::boolean, false)
        AND COALESCE(u.raw_user_meta_data->'additional_roles', '[]'::jsonb)
          @> '["service_provider"]'::jsonb
      )
    );
$$;

REVOKE ALL ON FUNCTION public.count_workspace_service_providers(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_workspace_service_providers(bigint) FROM anon;
REVOKE ALL ON FUNCTION public.count_workspace_service_providers(bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.count_workspace_service_providers(bigint) TO service_role;

COMMENT ON FUNCTION public.count_workspace_service_providers(bigint) IS
  'Count active service providers for a workspace from auth.users metadata. service_role only.';
