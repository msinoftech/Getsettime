-- One-time backfill: user_departments from auth user_metadata.departments
insert into public.user_departments (user_id, department_id, workspace_id)
select u.id, (d_id::text)::bigint, (u.raw_user_meta_data->>'workspace_id')::bigint
from auth.users u,
     jsonb_array_elements_text(coalesce(u.raw_user_meta_data->'departments', '[]'::jsonb)) as d_id
where (u.raw_user_meta_data->>'workspace_id') is not null
  and (d_id::text)::bigint is not null
  and exists (
    select 1 from public.departments d
    where d.id = (d_id::text)::bigint
      and d.workspace_id = (u.raw_user_meta_data->>'workspace_id')::bigint
  )
  and not exists (
    select 1 from public.user_departments ud
    where ud.user_id = u.id
      and ud.department_id = (d_id::text)::bigint
      and ud.workspace_id = (u.raw_user_meta_data->>'workspace_id')::bigint
  );

-- user_services from services.meta_data.service_providers
insert into public.user_services (user_id, service_id, workspace_id)
select (sp->>'id')::uuid, s.id, s.workspace_id
from public.services s,
     jsonb_array_elements(coalesce(s.meta_data->'service_providers', '[]'::jsonb)) as sp
where (sp->>'id') is not null
  and exists (select 1 from auth.users au where au.id = (sp->>'id')::uuid)
  and not exists (
    select 1 from public.user_services us
    where us.user_id = (sp->>'id')::uuid
      and us.service_id = s.id
      and us.workspace_id = s.workspace_id
  );

-- user_departments from departments.meta_data.service_providers (SP-only assign path)
insert into public.user_departments (user_id, department_id, workspace_id)
select distinct (sp->>'id')::uuid, d.id, d.workspace_id
from public.departments d,
     jsonb_array_elements(coalesce(d.meta_data->'service_providers', '[]'::jsonb)) as sp
where (sp->>'id') is not null
  and exists (select 1 from auth.users au where au.id = (sp->>'id')::uuid)
  and not exists (
    select 1 from public.user_departments ud
    where ud.user_id = (sp->>'id')::uuid
      and ud.department_id = d.id
      and ud.workspace_id = d.workspace_id
  );
