'use client';

import { useEffect, useState } from 'react';
import {
  resolveAvatarUrlFromMetadata,
  resolveDisplayNameFromMetadata,
} from '@app/db/user-avatar';
import { useAuth } from '@/src/providers/AuthProvider';
import {
  readCachedProfileImage,
  subscribeProfileImageCache,
} from '@/src/utils/profile_image_cache';

export function useCurrentUserAvatar() {
  const { user } = useAuth();
  const metadata = (user?.user_metadata ?? null) as Record<string, unknown> | null;
  const email = user?.email ?? undefined;

  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    const cached = readCachedProfileImage();
    if (cached) return cached;
    return resolveAvatarUrlFromMetadata(metadata);
  });

  useEffect(() => {
    const update = () => {
      const cached = readCachedProfileImage();
      setAvatarUrl(cached ?? resolveAvatarUrlFromMetadata(metadata));
    };

    update();
    return subscribeProfileImageCache(update);
  }, [metadata]);

  const displayName = resolveDisplayNameFromMetadata(metadata, email);

  return {
    avatarUrl,
    displayName,
    email: email ?? null,
  };
}
