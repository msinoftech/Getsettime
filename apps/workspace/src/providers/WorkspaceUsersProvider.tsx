'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthProvider';
import {
  fetchTeamMembersApi,
  type TeamMemberApiRecord,
} from '@/src/lib/team_members_api';

export type WorkspaceUser = TeamMemberApiRecord;

export type WorkspaceUsersContextValue = {
  members: WorkspaceUser[];
  byId: Map<string, WorkspaceUser>;
  byEmail: Map<string, WorkspaceUser>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getAvatarUrl: (userId?: string | null) => string | null;
  getDisplayName: (userId?: string | null) => string;
  getMember: (userId?: string | null) => WorkspaceUser | undefined;
  getMemberByEmail: (email?: string | null) => WorkspaceUser | undefined;
};

const WorkspaceUsersContext = createContext<WorkspaceUsersContextValue | null>(
  null
);

function buildMaps(members: WorkspaceUser[]) {
  const byId = new Map<string, WorkspaceUser>();
  const byEmail = new Map<string, WorkspaceUser>();
  for (const member of members) {
    byId.set(member.id, member);
    const emailKey = member.email?.trim().toLowerCase();
    if (emailKey) byEmail.set(emailKey, member);
  }
  return { byId, byEmail };
}

export function WorkspaceUsersProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, accessToken } = useAuth();
  const userId = user?.id ?? null;
  const workspaceIdRaw = user?.user_metadata?.workspace_id;
  const workspaceId =
    typeof workspaceIdRaw === 'number'
      ? workspaceIdRaw
      : parseInt(String(workspaceIdRaw ?? ''), 10);
  const cacheKey =
    userId && Number.isFinite(workspaceId) && workspaceId > 0
      ? `${userId}:${workspaceId}`
      : userId;

  const [members, setMembers] = useState<WorkspaceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchGenerationRef = useRef(0);

  const clearState = useCallback(() => {
    setMembers([]);
    setError(null);
    setLoading(false);
  }, []);

  const loadFromNetwork = useCallback(
    async (options?: { showLoading?: boolean; force?: boolean }) => {
      if (!userId || !cacheKey || !accessToken) {
        clearState();
        return;
      }

      const generation = ++fetchGenerationRef.current;
      if (options?.showLoading !== false) {
        setLoading(true);
      }

      try {
        const json = await fetchTeamMembersApi(accessToken, cacheKey, {
          force: options?.force,
        });

        if (generation !== fetchGenerationRef.current) return;

        setMembers(json.teamMembers ?? []);
        setError(null);
      } catch (err) {
        if (generation !== fetchGenerationRef.current) return;
        setMembers([]);
        setError(err instanceof Error ? err.message : 'Failed to load team members');
      } finally {
        if (generation === fetchGenerationRef.current) {
          setLoading(false);
        }
      }
    },
    [accessToken, cacheKey, clearState, userId]
  );

  useEffect(() => {
    void loadFromNetwork();
  }, [loadFromNetwork]);

  const refresh = useCallback(async () => {
    await loadFromNetwork({ showLoading: false, force: true });
  }, [loadFromNetwork]);

  const { byId, byEmail } = useMemo(() => buildMaps(members), [members]);

  const getMember = useCallback(
    (id?: string | null) => {
      if (!id) return undefined;
      return byId.get(id);
    },
    [byId]
  );

  const getMemberByEmail = useCallback(
    (email?: string | null) => {
      const key = email?.trim().toLowerCase();
      if (!key) return undefined;
      return byEmail.get(key);
    },
    [byEmail]
  );

  const getAvatarUrl = useCallback(
    (id?: string | null) => {
      const member = getMember(id);
      if (!member) return null;
      return member.avatar_url?.trim() || null;
    },
    [getMember]
  );

  const getDisplayName = useCallback(
    (id?: string | null) => {
      const member = getMember(id);
      if (!member) return 'User';
      return member.name?.trim() || member.email?.split('@')[0] || 'User';
    },
    [getMember]
  );

  const value = useMemo<WorkspaceUsersContextValue>(
    () => ({
      members,
      byId,
      byEmail,
      loading,
      error,
      refresh,
      getAvatarUrl,
      getDisplayName,
      getMember,
      getMemberByEmail,
    }),
    [
      members,
      byId,
      byEmail,
      loading,
      error,
      refresh,
      getAvatarUrl,
      getDisplayName,
      getMember,
      getMemberByEmail,
    ]
  );

  return (
    <WorkspaceUsersContext.Provider value={value}>
      {children}
    </WorkspaceUsersContext.Provider>
  );
}

export function useWorkspaceUsers(): WorkspaceUsersContextValue {
  const ctx = useContext(WorkspaceUsersContext);
  if (!ctx) {
    throw new Error('useWorkspaceUsers must be used within WorkspaceUsersProvider');
  }
  return ctx;
}

/** Safe variant for components that may render outside the provider (e.g. public routes). */
export function useWorkspaceUsersOptional(): WorkspaceUsersContextValue | null {
  return useContext(WorkspaceUsersContext);
}
