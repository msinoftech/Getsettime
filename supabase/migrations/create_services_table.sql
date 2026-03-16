-- Create services table for workspace service management
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  workspace_id bigint not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text null,
  price numeric(10,2) null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add index for workspace_id for faster queries
create index if not exists idx_services_workspace_id on public.services(workspace_id);

-- Enable Row Level Security
alter table public.services enable row level security;

-- Create RLS policies
-- Allow authenticated users to read services from their workspace
create policy "Users can view services from their workspace"
  on public.services for select
  using (
    workspace_id = (
      select (raw_user_meta_data->>'workspace_id')::bigint 
      from auth.users 
      where id = auth.uid()
    )
  );

-- Allow authenticated users to insert services for their workspace
create policy "Users can create services for their workspace"
  on public.services for insert
  with check (
    workspace_id = (
      select (raw_user_meta_data->>'workspace_id')::bigint 
      from auth.users 
      where id = auth.uid()
    )
  );

-- Allow authenticated users to update services in their workspace
create policy "Users can update services in their workspace"
  on public.services for update
  using (
    workspace_id = (
      select (raw_user_meta_data->>'workspace_id')::bigint 
      from auth.users 
      where id = auth.uid()
    )
  );

-- Allow authenticated users to delete services from their workspace
create policy "Users can delete services from their workspace"
  on public.services for delete
  using (
    workspace_id = (
      select (raw_user_meta_data->>'workspace_id')::bigint 
      from auth.users 
      where id = auth.uid()
    )
  );

-- Add trigger to update updated_at timestamp
create or replace function public.update_services_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger services_updated_at
  before update on public.services
  for each row
  execute function public.update_services_updated_at();

