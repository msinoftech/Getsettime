'use client';

import { useWorkspaceSettingsContext } from '../providers/WorkspaceSettingsProvider';
import type { WorkspaceSettingsHook } from '../types/workspace';

/**
 * Consumes workspace settings from WorkspaceSettingsProvider (single fetch, shared across app).
 * Must be used within WorkspaceSettingsProvider.
 */
export function useWorkspaceSettings(): WorkspaceSettingsHook {
  return useWorkspaceSettingsContext();
}

