-- Optional cleanup after app reads/writes only user_services and user_departments.
-- Run in a maintenance window once production verified.

UPDATE public.services
SET meta_data = meta_data - 'service_providers'
WHERE meta_data ? 'service_providers';

UPDATE public.departments
SET meta_data = meta_data - 'service_providers'
WHERE meta_data ? 'service_providers';

-- Note: Clearing auth.users.raw_user_meta_data.departments requires Auth Admin API
-- (batch updateUserById); not expressible as a pure SQL migration against auth schema.
