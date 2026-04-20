-- Link each workspace-level profession row back to its originating catalog row
-- in `professions_list`. admin_professions_id is optional because "Other" (custom)
-- professions are not backed by a catalog entry.
alter table public.professions
  add column if not exists admin_professions_id bigint
  references public.professions_list (id) on delete set null;

create index if not exists idx_professions_admin_professions_id on public.professions(admin_professions_id);
