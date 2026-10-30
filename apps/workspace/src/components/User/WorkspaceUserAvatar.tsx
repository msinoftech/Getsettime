'use client';

import { useMemo } from 'react';
import { UserAvatar, type UserAvatarProps } from '@app/ui';
import { useWorkspaceUsersOptional } from '@/src/providers/WorkspaceUsersProvider';

export type WorkspaceUserAvatarProps = Omit<
  UserAvatarProps,
  'avatarUrl' | 'name' | 'email'
> & {
  userId?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  name?: string;
};

export function useWorkspaceUserAvatar(
  userId?: string | null,
  email?: string | null,
  explicitAvatarUrl?: string | null,
  explicitName?: string
) {
  const workspaceUsers = useWorkspaceUsersOptional();

  return useMemo(() => {
    const memberById = userId ? workspaceUsers?.getMember(userId) : undefined;
    const memberByEmail =
      !memberById && email
        ? workspaceUsers?.getMemberByEmail(email)
        : undefined;
    const member = memberById ?? memberByEmail;

    const avatarUrl =
      explicitAvatarUrl?.trim() ||
      member?.avatar_url?.trim() ||
      null;

    const name =
      explicitName?.trim() ||
      member?.name?.trim() ||
      member?.email?.split('@')[0] ||
      email?.split('@')[0] ||
      undefined;

    const resolvedEmail = email?.trim() || member?.email || undefined;

    return { avatarUrl, name, email: resolvedEmail };
  }, [
    email,
    explicitAvatarUrl,
    explicitName,
    userId,
    workspaceUsers,
  ]);
}

export function WorkspaceUserAvatar({
  userId,
  email,
  avatarUrl: explicitAvatarUrl,
  name: explicitName,
  ...avatarProps
}: WorkspaceUserAvatarProps) {
  const { avatarUrl, name, email: resolvedEmail } = useWorkspaceUserAvatar(
    userId,
    email,
    explicitAvatarUrl,
    explicitName
  );

  return (
    <UserAvatar
      {...avatarProps}
      avatarUrl={avatarUrl}
      name={name}
      email={resolvedEmail}
    />
  );
}
