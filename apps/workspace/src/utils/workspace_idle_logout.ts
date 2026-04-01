const DEFAULT_IDLE_MS = 15 * 60 * 1000;
const DEFAULT_WARNING_MS = 60 * 1000;
const MIN_IDLE_MS = 60 * 1000;
const MAX_IDLE_MS = 24 * 60 * 60 * 1000;
const MIN_WARNING_MS = 10 * 1000;

function parseEnvMs(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
}

export type workspace_idle_logout_durations = {
  idleMs: number;
  warningMs: number;
};

export function getWorkspaceIdleLogoutDurations(): workspace_idle_logout_durations {
  const idleMs = parseEnvMs(
    process.env.NEXT_PUBLIC_WORKSPACE_IDLE_LOGOUT_MS,
    DEFAULT_IDLE_MS,
    MIN_IDLE_MS,
    MAX_IDLE_MS
  );

  let warningMs = parseEnvMs(
    process.env.NEXT_PUBLIC_WORKSPACE_IDLE_WARNING_MS,
    DEFAULT_WARNING_MS,
    MIN_WARNING_MS,
    idleMs
  );

  if (warningMs > idleMs) {
    warningMs = Math.min(DEFAULT_WARNING_MS, idleMs);
  }

  return { idleMs, warningMs };
}
