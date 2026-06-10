import { FALLBACK_TIMEZONE, STORAGE_TTL_MS, TIMEZONE_STORAGE_KEY } from './constants';

type CachedTimezone = { timezone: string; exp: number; manual?: boolean };

export function getBrowserTimezone(): string {
  if (typeof Intl === 'undefined') return FALLBACK_TIMEZONE;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.length > 0 ? tz : FALLBACK_TIMEZONE;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}

export function getCachedTimezone(): string | null {
  return getCachedManualTimezone();
}

/** Only returns timezone when the visitor explicitly chose it in the dropdown. */
export function getCachedManualTimezone(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TIMEZONE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedTimezone;
    if (!parsed.manual) return null;
    if (!parsed.timezone?.trim() || parsed.exp <= Date.now()) {
      localStorage.removeItem(TIMEZONE_STORAGE_KEY);
      return null;
    }
    return parsed.timezone.trim();
  } catch {
    return null;
  }
}

export function saveTimezone(timezone: string): void {
  saveManualTimezone(timezone);
}

export function saveManualTimezone(timezone: string): void {
  if (typeof window === 'undefined') return;
  const tz = timezone.trim();
  if (!tz) return;
  const payload: CachedTimezone = {
    timezone: tz,
    exp: Date.now() + STORAGE_TTL_MS,
    manual: true,
  };
  localStorage.setItem(TIMEZONE_STORAGE_KEY, JSON.stringify(payload));
}

export function clearManualTimezone(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TIMEZONE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
