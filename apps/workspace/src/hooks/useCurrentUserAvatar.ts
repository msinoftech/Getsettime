'use client';

import { useEffect, useState } from 'react';
import { resolveDisplayNameFromMetadata } from '@app/db/user-avatar';
import { useAuth } from '@/src/providers/AuthProvider';
import {
  readCachedProfileImage,
  subscribeProfileImageCache,
} from '@/src/utils/profile_image_cache';

function workspaceIdFromMetadata(
  metadata: Record<string, unknown> | null
): string | number | null {
  const raw = metadata?.workspace_id;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') return raw.trim();
  return null;
}

/** Uploaded profile photo only — do not fall back to OAuth `picture`. */
function uploadedAvatarUrlFromMetadata(
  metadata: Record<string, unknown> | null
): string | null {
  const raw = metadata?.avatar_url;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed !== '' ? trimmed : null;
}

function resolveCurrentAvatarUrl(
  userId: string | null,
  workspaceId: string | number | null,
  metadata: Record<string, unknown> | null
): string | null {
  if (!userId) return null;
  // Scoped cache first (same user/workspace only) for optimistic updates after save.
  return (
    readCachedProfileImage(userId, workspaceId) ??
    uploadedAvatarUrlFromMetadata(metadata)
  );
}

export function useCurrentUserAvatar() {
  const { user } = useAuth();
  const metadata = (user?.user_metadata ?? null) as Record<string, unknown> | null;
  const email = user?.email ?? undefined;
  const userId = user?.id ?? null;
  const workspaceId = workspaceIdFromMetadata(metadata);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(() =>
    resolveCurrentAvatarUrl(userId, workspaceId, metadata)
  );

  useEffect(() => {
    const update = () => {
      setAvatarUrl(resolveCurrentAvatarUrl(userId, workspaceId, metadata));
    };

    update();
    return subscribeProfileImageCache(update);
  }, [metadata, userId, workspaceId]);

  const displayName = resolveDisplayNameFromMetadata(metadata, email);

  return {
    avatarUrl,
    displayName,
    email: email ?? null,
  };
}
