/**
 * Extract local date/time parts from a UTC ISO string in a specific timezone.
 * Used for availability validation where schedule times are in workspace/client timezone.
 */
export interface LocalTimeParts {
  dayOfWeek: number; // 0=Sun, 1=Mon, ...
  dateStr: string; // YYYY-MM-DD
  hours: number;
  minutes: number;
  startMinutes: number; // hours * 60 + minutes
}

export function getLocalTimePartsInTimezone(
  isoString: string,
  timezone: string
): LocalTimeParts {
  const date = new Date(isoString);

  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = dateFormatter.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const weekday = getPart('weekday');
  const hour = parseInt(getPart('hour'), 10) || 0;
  const minute = parseInt(getPart('minute'), 10) || 0;

  const dayOrder: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayOfWeek = dayOrder[weekday] ?? 0;
  const dateStr = `${year}-${month}-${day}`;
  const startMinutes = hour * 60 + minute;

  return { dayOfWeek, dateStr, hours: hour, minutes: minute, startMinutes };
}
