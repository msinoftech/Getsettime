import type { WorkspaceSettings } from '../types/workspace';
import {
  patch_workspace_shell_cache,
  type workspace_shell_workspace,
} from './workspace_shell_cache';

/**
 * Patch localStorage settings from a POST /api/settings (or sub-route) response.
 * Dispatches WORKSPACE_SHELL_CACHE_UPDATED so WorkspaceSettingsProvider updates in-memory state.
 */
export function sync_settings_response(
  userId: string,
  result: { settings?: WorkspaceSettings | null }
): void {
  if (!userId || !result?.settings) return;
  patch_workspace_shell_cache(userId, { settings: result.settings });
}

/**
 * Patch localStorage workspace from a PUT /api/workspace (or related) response.
 */
export function sync_workspace_response(
  userId: string,
  result: { workspace?: workspace_shell_workspace | null }
): void {
  if (!userId || !result?.workspace) return;
  patch_workspace_shell_cache(userId, { workspace: result.workspace });
}
