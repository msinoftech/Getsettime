export type dashboard_summary_service_row = {
  id: string;
  name: string;
  department_name: string | null;
};

/** Response shape from GET /api/dashboard/summary */
export type dashboard_summary = {
  bookings_total: number;
  /** Bookings with start_at strictly after current server time */
  upcoming_bookings_count: number;
  /** Length 7, aligned with `week_days` query order */
  bookings_by_day: number[];
  /** Counts per status; `pending` includes rows with null status (legacy chart behavior) */
  bookings_by_status: Record<string, number>;
  /** null when caller is not workspace_admin or manager */
  team_members_count: number | null;
  services: dashboard_summary_service_row[];
  /** Completed/total bookings for the current week window (for completion-rate trend) */
  completion_this_week: { completed: number; total: number };
  /** Completed/total bookings for the previous week window */
  completion_prev_week: { completed: number; total: number };
  /** Non-deleted bookings count for the current calendar month */
  bookings_this_month: number;
  /** Non-deleted bookings count for the previous calendar month */
  bookings_prev_month: number;
};
