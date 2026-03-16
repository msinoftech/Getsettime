-- Add profession_id FK to workspaces (replaces the free-text 'type' column)
alter table if exists public.workspaces
  add column if not exists profession_id bigint references public.professions(id);

-- Migrate existing type data to profession_id
update public.workspaces w
  set profession_id = p.id
  from public.professions p
  where w.type is not null
    and lower(w.type) = lower(p.name)
    and w.profession_id is null;
