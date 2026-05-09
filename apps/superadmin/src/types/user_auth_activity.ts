export type user_auth_activity_event_type = "login" | "logout";

export type user_auth_activity = {
  id: string;
  user_id: string;
  workspace_id: number;
  event_type: user_auth_activity_event_type;
  supabase_auth_event: string | null;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  auth_session_id: string | null;
  created_at: string;
  workspaces?: { name: string } | null;
};
