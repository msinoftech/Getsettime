export type user_auth_activity_user_summary = {
  user_id: string;
  /** Present after migration add_user_email_to_user_auth_activity_user_summary_view */
  user_email?: string | null;
  workspace_id: number;
  workspace_name: string | null;
  last_activity_at: string;
  /** PostgREST may return bigint as string */
  event_count: number | string;
};
