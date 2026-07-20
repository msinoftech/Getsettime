import type { WorkspaceSettings } from '../types/workspace';

export const WORKSPACE_SHELL_CACHE_UPDATED = 'workspace-shell-cache-updated';

const CACHE_KEY_PREFIX = 'workspace_shell_v1_';

export type workspace_shell_workspace = {
  name?: string | null;
  slug?: string | null;
  logo_url?: string | null;
  profession_name?: string | null;
  type?: string | null;
  admin_professions_id?: number | null;
};

export type workspace_shell_cache_payload = {
  settings: WorkspaceSettings;
  workspace: workspace_shell_workspace;
  cached_at: string;
};

export type workspace_shell_cache_patch = {
  settings?: WorkspaceSettings;
  workspace?: Partial<workspace_shell_workspace>;
};

function cache_key(userId: string): string {
  return `${CACHE_KEY_PREFIX}${userId}`;
}

function is_browser(): boolean {
  return typeof window !== 'undefined';
}

function dispatch_cache_updated(userId: string): void {
  if (!is_browser()) return;
  window.dispatchEvent(
    new CustomEvent(WORKSPACE_SHELL_CACHE_UPDATED, { detail: { userId } })
  );
}

export function read_workspace_shell_cache(
  userId: string
): workspace_shell_cache_payload | null {
  if (!is_browser() || !userId) return null;
  try {
    const raw = window.localStorage.getItem(cache_key(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as workspace_shell_cache_payload;
    if (!parsed || typeof parsed !== 'object') {
      clear_workspace_shell_cache(userId);
      return null;
    }
    if (!parsed.settings || typeof parsed.settings !== 'object') {
      clear_workspace_shell_cache(userId);
      return null;
    }
    if (!parsed.workspace || typeof parsed.workspace !== 'object') {
      clear_workspace_shell_cache(userId);
      return null;
    }
    return parsed;
  } catch {
    clear_workspace_shell_cache(userId);
    return null;
  }
}

export function write_workspace_shell_cache(
  userId: string,
  payload: Omit<workspace_shell_cache_payload, 'cached_at'> & { cached_at?: string }
): void {
  if (!is_browser() || !userId) return;
  try {
    const entry: workspace_shell_cache_payload = {
      settings: payload.settings ?? {},
      workspace: payload.workspace ?? {},
      cached_at: payload.cached_at ?? new Date().toISOString(),
    };
    window.localStorage.setItem(cache_key(userId), JSON.stringify(entry));
    dispatch_cache_updated(userId);
  } catch {
    // Quota or private mode — ignore write failures
  }
}

export function patch_workspace_shell_cache(
  userId: string,
  partial: workspace_shell_cache_patch
): workspace_shell_cache_payload | null {
  if (!is_browser() || !userId) return null;
  const existing = read_workspace_shell_cache(userId);
  const next: workspace_shell_cache_payload = {
    settings:
      partial.settings !== undefined
        ? partial.settings
        : (existing?.settings ?? {}),
    workspace: {
      ...(existing?.workspace ?? {}),
      ...(partial.workspace ?? {}),
    },
    cached_at: new Date().toISOString(),
  };
  write_workspace_shell_cache(userId, next);
  return next;
}

export function clear_workspace_shell_cache(userId?: string): void {
  if (!is_browser()) return;
  try {
    if (userId) {
      window.localStorage.removeItem(cache_key(userId));
      return;
    }
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) keys.push(key);
    }
    for (const key of keys) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

export function is_workspace_shell_cache_key(key: string | null): boolean {
  return Boolean(key?.startsWith(CACHE_KEY_PREFIX));
}
