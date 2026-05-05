-- Link contacts for household / family (previous invitee linkage on edit)
alter table public.contacts add column if not exists related_contact_id bigint null;
alter table public.contacts add column if not exists relationship text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contacts_related_contact_id_fkey'
  ) then
    alter table public.contacts
      add constraint contacts_related_contact_id_fkey
      foreign key (related_contact_id) references public.contacts (id) on delete set null;
  end if;
end $$;

create index if not exists idx_contacts_related_contact_id on public.contacts (related_contact_id);
