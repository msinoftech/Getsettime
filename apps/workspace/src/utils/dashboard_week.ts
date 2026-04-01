/**
 * Rolling 7-day window ending today (same logic as the legacy dashboard chart).
 * `dateString` uses local calendar day expressed via `Date#toISOString().split("T")[0]` (legacy behavior).
 */
export type dashboard_week_day = { date: Date; label: string; dateString: string };

export function get_dashboard_week_days(): dashboard_week_day[] {
  const dates: dashboard_week_day[] = [];
  const today = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const dayName = dayNames[date.getDay()];
    const day = date.getDate();
    const label = `${dayName} ${day}`;
    const dateString = date.toISOString().split('T')[0];

    dates.push({ date, label, dateString });
  }

  return dates;
}

/** Seven YYYY-MM-DD strings (oldest → newest) for `/api/dashboard/summary?week_days=`. */
export function get_dashboard_week_day_param_values(): string[] {
  return get_dashboard_week_days().map((d) => d.dateString);
}
