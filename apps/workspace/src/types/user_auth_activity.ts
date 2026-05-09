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
};

/** Body accepted by POST /api/auth/activity-log (server fills user_id, workspace_id, ip). */
export type user_auth_activity_log_request = {
  event_type: user_auth_activity_event_type;
  supabase_auth_event?: string | null;
  reason?: string | null;
};
