alter table public.professions_list
  add column if not exists icon text;

update public.professions_list
set icon = 'FcOrganization'
where icon is null or btrim(icon) = '';
