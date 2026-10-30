export type UserAvatarMetadata = {
  avatar_url?: unknown;
  picture?: unknown;
  full_name?: unknown;
  name?: unknown;
};

function trimString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed !== '' ? trimmed : null;
}

/** Resolve profile image URL from auth user_metadata (uploaded avatar, then OAuth picture). */
export function resolveAvatarUrlFromMetadata(
  meta: UserAvatarMetadata | null | undefined
): string | null {
  if (!meta) return null;
  return trimString(meta.avatar_url) ?? trimString(meta.picture);
}

/** Resolve display name from auth user_metadata with optional email fallback. */
export function resolveDisplayNameFromMetadata(
  meta: UserAvatarMetadata | null | undefined,
  fallbackEmail?: string
): string {
  const fullName = trimString(meta?.full_name);
  if (fullName) return fullName;
  const name = trimString(meta?.name);
  if (name) return name;
  const email = trimString(fallbackEmail);
  if (email) {
    const local = email.split('@')[0]?.trim();
    if (local) return local;
    return email;
  }
  return 'User';
}
