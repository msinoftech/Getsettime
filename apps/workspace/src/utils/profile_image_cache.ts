export const WORKSPACE_PROFILE_IMAGE_KEY = 'workspace_profile_image';
export const WORKSPACE_PROFILE_IMAGE_EVENT = 'workspace-profile-image-updated';

function normalizeCachedUrl(value: string | null): string | null {
  if (!value || value.startsWith('data:')) return null;
  const trimmed = value.trim();
  return trimmed !== '' ? trimmed : null;
}

export function readCachedProfileImage(): string | null {
  if (typeof window === 'undefined') return null;
  return normalizeCachedUrl(window.localStorage.getItem(WORKSPACE_PROFILE_IMAGE_KEY));
}

export function writeCachedProfileImage(url: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  const normalized = normalizeCachedUrl(url ?? null);
  if (normalized) {
    window.localStorage.setItem(WORKSPACE_PROFILE_IMAGE_KEY, normalized);
  } else {
    window.localStorage.removeItem(WORKSPACE_PROFILE_IMAGE_KEY);
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
