'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthProvider';
import type { GeneralSettings, AvailabilitySettings, WorkspaceSettings, WorkspaceSettingsHook } from '../types/workspace';
import { resolve_workspace_logo_src } from '../utils/workspace_logo';

const WorkspaceSettingsContext = createContext<WorkspaceSettingsHook | null>(null);

export function WorkspaceSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<WorkspaceSettings>({});
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [workspaceLogo, setWorkspaceLogo] = useState<string | null>(null);
  const [workspaceProfessionLabel, setWorkspaceProfessionLabel] = useState<string | null>(null);
  const [workspaceSlug, setWorkspaceSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setWorkspaceProfessionLabel(null);
      setWorkspaceSlug(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setLoading(false);
        setWorkspaceProfessionLabel(null);
        setWorkspaceSlug(null);
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
      setSettings(settingsResult.settings || {});

      if (workspaceResponse.ok) {
        const workspaceResult = await workspaceResponse.json();
        if (workspaceResult?.workspace) {
          const w = workspaceResult.workspace as {
            name?: string | null;
            slug?: string | null;
            logo_url?: string | null;
            profession_name?: string | null;
            type?: string | null;
          };
          setWorkspaceName(w.name || null);
          setWorkspaceLogo(w.logo_url || null);
          setWorkspaceSlug(
            typeof w.slug === 'string' && w.slug.trim() ? w.slug.trim() : null
          );
          const prof =
            (typeof w.profession_name === "string" && w.profession_name.trim()) ||
            (typeof w.type === "string" && w.type.trim()) ||
            null;
          setWorkspaceProfessionLabel(prof);
        }
      } else {
        setWorkspaceName(null);
        setWorkspaceLogo(null);
        setWorkspaceProfessionLabel(null);
        setWorkspaceSlug(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

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
    loading,
    error,
    refetch: fetchSettings,
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
