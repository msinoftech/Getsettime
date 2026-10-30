export type TeamMemberApiRecord = {
  id: string;
  email: string;
  name: string;
  education: string | null;
  experience: string | null;
  specialty: string | null;
  bio: string | null;
  role: string | null;
  additional_roles: string[];
  departments: number[];
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  email_confirmed_at: string | null;
  deactivated: boolean;
  is_workspace_owner: boolean;
  onboarding_completed: boolean | null;
  bookings_this_week: number;
};

export type TeamMembersApiResponse = {
  teamMembers: TeamMemberApiRecord[];
};

const inflightByKey = new Map<string, Promise<TeamMembersApiResponse>>();

export type UserAvatarApiRecord = {
  id: string;
  email: string | null;
  name: string;
  avatar_url: string | null;
};

type UserAvatarsApiResponse = {
  users: UserAvatarApiRecord[];
};

const avatarCacheById = new Map<string, UserAvatarApiRecord>();
const avatarInflightByKey = new Map<string, Promise<UserAvatarsApiResponse>>();

/** Deduped fetch for /api/team-members (collapses parallel mounts / Strict Mode). */
export async function fetchTeamMembersApi(
  accessToken: string,
  cacheKey: string,
  options?: { force?: boolean }
): Promise<TeamMembersApiResponse> {
  if (!options?.force) {
    const existing = inflightByKey.get(cacheKey);
    if (existing) return existing;
  }

  const promise = (async () => {
    const res = await fetch('/api/team-members', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Failed to load team members');
    }
    return (await res.json()) as TeamMembersApiResponse;
  })();

  inflightByKey.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    if (inflightByKey.get(cacheKey) === promise) {
      inflightByKey.delete(cacheKey);
    }
  }
}

/** Fetch avatars for ids missing from the workspace roster cache. */
export async function fetchUserAvatarsApi(
  accessToken: string,
  ids: string[]
): Promise<UserAvatarApiRecord[]> {
  const missing = ids.filter((id) => id && !avatarCacheById.has(id));
  if (missing.length === 0) {
    return ids
      .map((id) => avatarCacheById.get(id))
      .filter((row): row is UserAvatarApiRecord => Boolean(row));
  }

  const cacheKey = missing.sort().join(',');
  let promise = avatarInflightByKey.get(cacheKey);
  if (!promise) {
    promise = (async () => {
      const res = await fetch(
        `/api/users/avatars?ids=${encodeURIComponent(missing.join(','))}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Failed to load user avatars');
      }
      return (await res.json()) as UserAvatarsApiResponse;
    })();
    avatarInflightByKey.set(cacheKey, promise);
  }

  try {
    const json = await promise;
    for (const user of json.users ?? []) {
      avatarCacheById.set(user.id, user);
    }
  } finally {
    if (avatarInflightByKey.get(cacheKey) === promise) {
      avatarInflightByKey.delete(cacheKey);
    }
  }

  return ids
    .map((id) => avatarCacheById.get(id))
    .filter((row): row is UserAvatarApiRecord => Boolean(row));
}
