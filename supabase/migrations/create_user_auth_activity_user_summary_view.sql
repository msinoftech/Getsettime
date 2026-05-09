-- Aggregated auth activity per user per workspace (superadmin grouped list).
create or replace view public.user_auth_activity_user_summary as
select
  u.user_id,
  au.email as user_email,
  u.workspace_id,
  w.name as workspace_name,
  max(u.created_at) as last_activity_at,
  count(*)::bigint as event_count
from public.user_auth_activity u
inner join public.workspaces w on w.id = u.workspace_id
left join auth.users au on au.id = u.user_id
group by u.user_id, au.email, u.workspace_id, w.name;

comment on view public.user_auth_activity_user_summary is 'One row per user per workspace for auth activity grouping in superadmin';
