'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthProvider';
import type { GeneralSettings, AvailabilitySettings, WorkspaceSettings, WorkspaceSettingsHook } from '../types/workspace';

const WorkspaceSettingsContext = createContext<WorkspaceSettingsHook | null>(null);

export function WorkspaceSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<WorkspaceSettings>({});
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [workspaceLogo, setWorkspaceLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
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
      setSettings(settingsResult.settings || {});

      if (workspaceResponse.ok) {
        const workspaceResult = await workspaceResponse.json();
        if (workspaceResult?.workspace) {
          setWorkspaceName(workspaceResult.workspace.name || null);
          setWorkspaceLogo(workspaceResult.workspace.logo_url || null);
        }
      } else {
        setWorkspaceName(null);
        setWorkspaceLogo(null);
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

  const value: WorkspaceSettingsHook = {
    settings,
    general: (settings.general || {}) as GeneralSettings,
    availability: (settings.availability || {}) as AvailabilitySettings,
    workspaceName,
    workspaceLogo,
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
