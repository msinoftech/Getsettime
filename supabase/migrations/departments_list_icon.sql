-- Default icon for catalog departments (ids from @app/icons DEPARTMENT_ICONS).
-- Workspace departments inherit it by name unless they set meta_data.icon.
alter table public.departments_list
  add column if not exists icon text;
