'use client';

import React, { useMemo, useState } from 'react';
import { userInitialChar, userInitials } from './userInitials';

export type UserAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type UserAvatarShape = 'circle' | 'rounded';

export type UserAvatarProps = {
  avatarUrl?: string | null;
  name?: string;
  email?: string;
  size?: UserAvatarSize;
  shape?: UserAvatarShape;
  className?: string;
};

const SIZE_CLASSES: Record<UserAvatarSize, string> = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-sm',
  lg: 'h-10 w-10 text-sm',
  xl: 'h-22 w-22 text-xl',
};

function shapeClass(shape: UserAvatarShape): string {
  return shape === 'rounded' ? 'rounded-lg' : 'rounded-full';
}

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function UserAvatar({
  avatarUrl,
  name,
  email,
  size = 'md',
  shape = 'circle',
  className,
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const sizeClass = SIZE_CLASSES[size];
  const radiusClass = shapeClass(shape);

  const displayName = name?.trim() || email?.trim() || 'User';
  const initials = useMemo(() => {
    if (name?.trim()) return userInitials(name);
    return userInitialChar(name, email);
  }, [name, email]);

  const showImage =
    typeof avatarUrl === 'string' &&
    avatarUrl.trim() !== '' &&
    !imageFailed;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl.trim()}
        alt={displayName}
        loading="lazy"
        onError={() => setImageFailed(true)}
        className={cn(sizeClass, radiusClass, 'shrink-0 object-cover', className)}
      />
    );
  }

  return (
    <span
      aria-hidden={!!name || !!email}
      className={cn(
        sizeClass,
        radiusClass,
        'flex shrink-0 items-center justify-center bg-indigo-100 font-semibold text-indigo-700',
        className
      )}
    >
      {initials}
    </span>
  );
}
