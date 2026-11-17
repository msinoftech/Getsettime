/** Legacy unscoped key — caused cross-user/workspace avatar leaks in the Topbar. */
export const WORKSPACE_PROFILE_IMAGE_KEY = 'workspace_profile_image';
export const WORKSPACE_PROFILE_IMAGE_EVENT = 'workspace-profile-image-updated';

const SCOPED_KEY_PREFIX = 'workspace_profile_image:';

function normalizeCachedUrl(value: string | null): string | null {
  if (!value || value.startsWith('data:')) return null;
  const trimmed = value.trim();
  return trimmed !== '' ? trimmed : null;
}

function normalizeWorkspaceId(workspaceId?: string | number | null): string {
  if (workspaceId == null) return 'none';
  const raw = typeof workspaceId === 'number' ? String(workspaceId) : workspaceId.trim();
  return raw !== '' ? raw : 'none';
}

export function profileImageCacheKey(
  userId: string,
  workspaceId?: string | number | null
): string {
  return `${SCOPED_KEY_PREFIX}${userId}:${normalizeWorkspaceId(workspaceId)}`;
}

function clearLegacyProfileImageKey(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(WORKSPACE_PROFILE_IMAGE_KEY);
}

export function readCachedProfileImage(
  userId?: string | null,
  workspaceId?: string | number | null
): string | null {
  if (typeof window === 'undefined' || !userId?.trim()) return null;
  // Never fall back to the legacy global key — it can belong to another account.
  clearLegacyProfileImageKey();
  return normalizeCachedUrl(
    window.localStorage.getItem(profileImageCacheKey(userId.trim(), workspaceId))
  );
}

export function writeCachedProfileImage(
  url: string | null | undefined,
  userId?: string | null,
  workspaceId?: string | number | null
): void {
  if (typeof window === 'undefined') return;
  clearLegacyProfileImageKey();
  if (!userId?.trim()) {
    window.dispatchEvent(new Event(WORKSPACE_PROFILE_IMAGE_EVENT));
    return;
  }

  const key = profileImageCacheKey(userId.trim(), workspaceId);
  const normalized = normalizeCachedUrl(url ?? null);
  if (normalized) {
    window.localStorage.setItem(key, normalized);
  } else {
    window.localStorage.removeItem(key);
  }
  window.dispatchEvent(new Event(WORKSPACE_PROFILE_IMAGE_EVENT));
}

export function subscribeProfileImageCache(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  window.addEventListener(WORKSPACE_PROFILE_IMAGE_EVENT, callback);
  window.addEventListener('storage', callback);

  return () => {
    window.removeEventListener(WORKSPACE_PROFILE_IMAGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}
