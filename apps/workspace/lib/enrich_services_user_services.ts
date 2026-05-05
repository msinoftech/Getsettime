import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import { user_belongs_to_workspace } from '@/lib/team_members_workspace';

function parseMetaData(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function displayNameForUser(u: User): string {
  const m = u.user_metadata as Record<string, unknown> | undefined;
  const n = m?.name;
  if (typeof n === 'string' && n.trim() !== '') return n.trim();
  return u.email?.split('@')[0] ?? 'Unknown';
}

/**
 * Strips persisted service_providers from meta_data and attaches DB-backed
 * `service_providers: { id, name }[]` from `user_services`.
 */
export async function enrichServicesWithUserServiceProviders(
  adminClient: SupabaseClient,
  dataClient: SupabaseClient,
  workspaceId: string | number,
  services: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  const ws = Number(workspaceId);
  const { data: links, error: linkErr } = await dataClient
    .from('user_services')
    .select('service_id, user_id')
    .eq('workspace_id', ws);
  if (linkErr) {
    console.error('enrichServicesWithUserServiceProviders: user_services', linkErr);
  }
  const byService = new Map<string, string[]>();
  for (const l of links ?? []) {
    const sid = l.service_id as string;
    const uid = l.user_id as string;
    if (!byService.has(sid)) byService.set(sid, []);
    byService.get(sid)!.push(uid);
  }

  const { data: listResult, error: listErr } = await adminClient.auth.admin.listUsers();
  if (listErr) {
    console.error('enrichServicesWithUserServiceProviders: listUsers', listErr);
  }
  const users = listResult?.users ?? [];
  const nameById = new Map<string, string>();
  for (const u of users) {
    if (!user_belongs_to_workspace(u, workspaceId)) continue;
    nameById.set(u.id, displayNameForUser(u));
  }

  return services.map((svc) => {
    const id = svc.id as string;
    const meta = parseMetaData(svc.meta_data);
    const { service_providers: _sp, ...rest } = meta;
    const uids = [...new Set(byService.get(id) ?? [])];
    const service_providers = uids.map((uid) => ({
      id: uid,
      name: nameById.get(uid) ?? 'Unknown',
    }));
    return {
      ...svc,
      meta_data: { ...rest, service_providers },
    };
  });
}
