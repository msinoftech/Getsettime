-- Link catalog departments to a profession for onboarding filtering
alter table public.departments_list
  add column if not exists profession_id bigint references public.professions (id) on delete restrict;

create index if not exists idx_departments_list_profession_id on public.departments_list (profession_id);

-- Allow same department name for different professions; drop global unique name
alter table public.departments_list drop constraint if exists departments_list_name_key;

create unique index if not exists departments_list_profession_id_name_uidx
  on public.departments_list (profession_id, name)
  where profession_id is not null;

create unique index if not exists departments_list_null_prof_name_uidx
  on public.departments_list (name)
  where profession_id is null;
