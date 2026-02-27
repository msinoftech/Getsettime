-- Remove timezone column from contacts
alter table public.contacts drop column if exists timezone;
