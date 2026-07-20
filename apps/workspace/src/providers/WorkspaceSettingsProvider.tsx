'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useAuth } from './AuthProvider';
import type {
  GeneralSettings,
  AvailabilitySettings,
  WorkspaceSettings,
  WorkspaceSettingsHook,
  workspace_shell_patch,
} from '../types/workspace';
import { resolve_workspace_logo_src } from '../utils/workspace_logo';
import { get_provider_link_slug_for_user } from '@/lib/provider_booking_link';
import { ROLE_SERVICE_PROVIDER } from '@/src/constants/roles';
import {
  WORKSPACE_SHELL_CACHE_UPDATED,
  clear_workspace_shell_cache,
  is_workspace_shell_cache_key,
  patch_workspace_shell_cache,
  read_workspace_shell_cache,
  write_workspace_shell_cache,
  type workspace_shell_workspace,
} from '../lib/workspace_shell_cache';

const WorkspaceSettingsContext = createContext<WorkspaceSettingsHook | null>(null);

function resolve_profession_label(w: workspace_shell_workspace): string | null {
  return (
    (typeof w.profession_name === 'string' && w.profession_name.trim()) ||
    (typeof w.type === 'string' && w.type.trim()) ||
    null
  );
}

export function WorkspaceSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const userRole =
    typeof user?.user_metadata?.role === 'string' ? user.user_metadata.role : '';
  const userIdRef = useRef<string | null>(null);
  const previousUserIdRef = useRef<string | null>(null);

  const [settings, setSettings] = useState<WorkspaceSettings>({});
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [workspaceLogo, setWorkspaceLogo] = useState<string | null>(null);
  const [workspaceProfessionLabel, setWorkspaceProfessionLabel] = useState<string | null>(null);
  const [workspaceSlug, setWorkspaceSlug] = useState<string | null>(null);
  const [serviceProviderLinkSlug, setServiceProviderLinkSlug] = useState<string | null>(null);
  const [workspaceAdminProfessionsId, setWorkspaceAdminProfessionsId] = useState<number | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const applyWorkspaceFields = useCallback((w: workspace_shell_workspace | null) => {
    if (!w) {
      setWorkspaceName(null);
      setWorkspaceLogo(null);
      setWorkspaceProfessionLabel(null);
      setWorkspaceSlug(null);
      setWorkspaceAdminProfessionsId(null);
      return;
    }
    setWorkspaceName(w.name || null);
    setWorkspaceLogo(w.logo_url || null);
    setWorkspaceSlug(typeof w.slug === 'string' && w.slug.trim() ? w.slug.trim() : null);
    setWorkspaceProfessionLabel(resolve_profession_label(w));
    setWorkspaceAdminProfessionsId(
      typeof w.admin_professions_id === 'number' ? w.admin_professions_id : null
    );
  }, []);

  const applyShellData = useCallback(
    (
      loadedSettings: WorkspaceSettings,
      workspace: workspace_shell_workspace | null,
      role: string,
      uid: string | null
    ) => {
      setSettings(loadedSettings);
      if (role === ROLE_SERVICE_PROVIDER && uid) {
        setServiceProviderLinkSlug(
          get_provider_link_slug_for_user(loadedSettings.links, uid)
        );
      } else {
        setServiceProviderLinkSlug(null);
      }
      applyWorkspaceFields(workspace);
    },
    [applyWorkspaceFields]
  );

  const clearShellState = useCallback(() => {
    setSettings({});
    setWorkspaceName(null);
    setWorkspaceLogo(null);
    setWorkspaceProfessionLabel(null);
    setWorkspaceSlug(null);
    setServiceProviderLinkSlug(null);
    setWorkspaceAdminProfessionsId(null);
    setError(null);
  }, []);

  const fetchFromNetwork = useCallback(
    async (uid: string, role: string, options?: { showLoading?: boolean }) => {
      if (options?.showLoading !== false) {
        setLoading(true);
      }
      setError(null);

      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          clearShellState();
          setLoading(false);
          return;
        }

        const token = session.access_token;
        const [settingsResponse, workspaceResponse] = await Promise.all([
          fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/workspace', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (!settingsResponse.ok) {
          throw new Error('Failed to fetch workspace settings');
        }

        const settingsResult = await settingsResponse.json();
        const loadedSettings = (settingsResult.settings || {}) as WorkspaceSettings;

        let workspace: workspace_shell_workspace | null = null;
        if (workspaceResponse.ok) {
          const workspaceResult = await workspaceResponse.json();
          if (workspaceResult?.workspace) {
            workspace = workspaceResult.workspace as workspace_shell_workspace;
          }
        }

        applyShellData(loadedSettings, workspace, role, uid);
        write_workspace_shell_cache(uid, {
          settings: loadedSettings,
          workspace: workspace ?? {},
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      } finally {
        setLoading(false);
      }
    },
    [applyShellData, clearShellState]
  );

  const applyPatch = useCallback(
    (partial: workspace_shell_patch) => {
      const uid = userIdRef.current;
      if (!uid) return;

      const patched = patch_workspace_shell_cache(uid, {
        settings: partial.settings,
        workspace: partial.workspace,
      });
      if (!patched) return;

      const role =
        typeof user?.user_metadata?.role === 'string' ? user.user_metadata.role : userRole;
      applyShellData(patched.settings, patched.workspace, role, uid);
    },
    [applyShellData, user?.user_metadata?.role, userRole]
  );

  const refetch = useCallback(async () => {
    if (!userId) {
      clearShellState();
      setLoading(false);
      return;
    }
    await fetchFromNetwork(userId, userRole, { showLoading: true });
  }, [userId, userRole, fetchFromNetwork, clearShellState]);

  // Hydrate from cache or fetch on user id change
  useEffect(() => {
    if (!userId) {
      const previousId = previousUserIdRef.current;
      clearShellState();
      if (previousId) {
        clear_workspace_shell_cache(previousId);
      }
      previousUserIdRef.current = null;
      userIdRef.current = null;
      setLoading(false);
      return;
    }

    previousUserIdRef.current = userId;
    userIdRef.current = userId;

    const cached = read_workspace_shell_cache(userId);
    if (cached) {
      applyShellData(cached.settings, cached.workspace, userRole, userId);
      setLoading(false);
      return;
    }

    void fetchFromNetwork(userId, userRole, { showLoading: true });
  }, [userId, userRole, applyShellData, fetchFromNetwork, clearShellState]);

  // Same-tab + cross-tab cache updates
  useEffect(() => {
    if (!userId) return;

    const hydrateFromCache = () => {
      const cached = read_workspace_shell_cache(userId);
      if (!cached) return;
      applyShellData(cached.settings, cached.workspace, userRole, userId);
    };

    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;
      if (detail?.userId && detail.userId !== userId) return;
      hydrateFromCache();
    };

    const onStorage = (event: StorageEvent) => {
      if (!is_workspace_shell_cache_key(event.key)) return;
      if (event.key !== `workspace_shell_v1_${userId}`) return;
      hydrateFromCache();
    };

    window.addEventListener(WORKSPACE_SHELL_CACHE_UPDATED, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(WORKSPACE_SHELL_CACHE_UPDATED, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, [userId, userRole, applyShellData]);

  const general = (settings.general || {}) as GeneralSettings;
  const workspaceLogoResolved = useMemo(
    () => resolve_workspace_logo_src(workspaceLogo ?? general.logoUrl ?? null),
    [workspaceLogo, general.logoUrl]
  );

  const value: WorkspaceSettingsHook = {
    settings,
    general,
    availability: (settings.availability || {}) as AvailabilitySettings,
    workspaceName,
    workspaceLogo,
    workspaceLogoResolved,
    workspaceProfessionLabel,
    workspaceSlug,
    serviceProviderLinkSlug,
    workspaceAdminProfessionsId,
    loading,
    error,
    refetch,
    applyPatch,
  };

  return (
    <WorkspaceSettingsContext.Provider value={value}>
      {children}
    </WorkspaceSettingsContext.Provider>
  );
}

export function useWorkspaceSettingsContext(): WorkspaceSettingsHook {
  const ctx = useContext(WorkspaceSettingsContext);
  if (!ctx) {
    throw new Error('useWorkspaceSettings must be used within WorkspaceSettingsProvider');
  }
  return ctx;
}
