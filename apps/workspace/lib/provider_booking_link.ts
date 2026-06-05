import type { SupabaseClient } from '@supabase/supabase-js';

export type workspace_provider_link_entry = {
  slug?: string;
};

export type workspace_provider_links_settings = Record<
  string,
  workspace_provider_link_entry
>;

export function normalize_provider_link_slug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parse_workspace_provider_links(
  raw: unknown
): workspace_provider_links_settings {
  if (!raw || typeof raw !== 'object') return {};
  const out: workspace_provider_links_settings = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const slug = (value as { slug?: unknown }).slug;
    if (typeof slug === 'string' && slug.trim()) {
      out[key] = { slug: normalize_provider_link_slug(slug) };
    }
  }
  return out;
}

export function find_provider_id_by_link_slug(
  links: unknown,
  slug: string
): string | null {
  const normalized = normalize_provider_link_slug(slug);
  if (!normalized) return null;
  const parsed = parse_workspace_provider_links(links);
  for (const [providerId, entry] of Object.entries(parsed)) {
    if (entry.slug === normalized) return providerId;
  }
  return null;
}

export function get_provider_link_slug_for_user(
  links: unknown,
  providerId: string
): string | null {
  const parsed = parse_workspace_provider_links(links);
  return parsed[providerId]?.slug ?? null;
}

const MAX_PROVIDER_LINK_SUFFIX = 999;

export function provider_link_slug_base_from_name(
  name: string | null | undefined,
  emailFallback?: string | null
): string {
  const fromName = normalize_provider_link_slug(
    typeof name === 'string' ? name : ''
  );
  if (fromName) return fromName;

  const emailLocal =
    typeof emailFallback === 'string'
      ? emailFallback.split('@')[0] ?? ''
      : '';
  const fromEmail = normalize_provider_link_slug(emailLocal);
  if (fromEmail) return fromEmail;

  return 'provider';
}

export function collect_taken_provider_link_slugs(
  providerLinks: workspace_provider_links_settings,
  eventTypeSlugs: string[],
  excludeProviderId?: string
): Set<string> {
  const taken = new Set<string>();
  for (const slug of eventTypeSlugs) {
    const normalized = normalize_provider_link_slug(slug);
    if (normalized) taken.add(normalized);
  }
  for (const [providerId, entry] of Object.entries(providerLinks)) {
    if (excludeProviderId && providerId === excludeProviderId) continue;
    if (entry.slug) taken.add(entry.slug);
  }
  return taken;
}

export function pick_unique_provider_link_slug(
  baseSlug: string,
  taken: Set<string>
): string | null {
  const base = normalize_provider_link_slug(baseSlug);
  if (!base) return null;

  if (!taken.has(base)) return base;

  for (let n = 1; n <= MAX_PROVIDER_LINK_SUFFIX; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }

  return null;
}

export async function collect_workspace_taken_provider_link_slugs(
  supabase: SupabaseClient,
  workspaceId: number | string,
  excludeProviderId?: string
): Promise<{ taken: Set<string>; error: string | null }> {
  const { data: eventTypeRows, error: eventError } = await supabase
    .from('event_types')
    .select('slug')
    .eq('workspace_id', workspaceId);

  if (eventError) {
    return { taken: new Set(), error: eventError.message };
  }

  const eventSlugs: string[] = [];
  for (const row of eventTypeRows ?? []) {
    const s = (row as { slug?: unknown }).slug;
    if (typeof s === 'string' && s.trim()) eventSlugs.push(s);
  }

  const { data: configRow, error: configError } = await supabase
    .from('configurations')
    .select('settings')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (configError && configError.code !== 'PGRST116') {
    return { taken: new Set(), error: configError.message };
  }

  const links = parse_workspace_provider_links(
    (configRow?.settings as { links?: unknown } | undefined)?.links
  );

  return {
    taken: collect_taken_provider_link_slugs(links, eventSlugs, excludeProviderId),
    error: null,
  };
}

export async function resolve_unique_provider_link_slug(
  supabase: SupabaseClient,
  workspaceId: number | string,
  baseName: string | null | undefined,
  options?: { emailFallback?: string | null; excludeProviderId?: string }
): Promise<{ slug: string | null; error: string | null }> {
  const base = provider_link_slug_base_from_name(
    baseName,
    options?.emailFallback
  );

  const { taken, error } = await collect_workspace_taken_provider_link_slugs(
    supabase,
    workspaceId,
    options?.excludeProviderId
  );
  if (error) {
    return { slug: null, error };
  }

  const slug = pick_unique_provider_link_slug(base, taken);
  if (!slug) {
    return { slug: null, error: 'Could not generate a unique provider link' };
  }

  return { slug, error: null };
}

export function merge_workspace_provider_links(
  existing: unknown,
  incoming: unknown,
  userRole: string | undefined,
  userId: string
): workspace_provider_links_settings {
  const prev = parse_workspace_provider_links(existing);
  if (userRole !== 'service_provider') {
    return prev;
  }
  if (!incoming || typeof incoming !== 'object') {
    return prev;
  }
  const selfEntry = (incoming as Record<string, unknown>)[userId];
  if (!selfEntry || typeof selfEntry !== 'object') {
    return prev;
  }
  const slugRaw = (selfEntry as { slug?: unknown }).slug;
  const slug =
    typeof slugRaw === 'string' ? normalize_provider_link_slug(slugRaw) : '';
  if (!slug) {
    return prev;
  }
  return { ...prev, [userId]: { slug } };
}

export async function assert_provider_link_slug_available(
  supabase: SupabaseClient,
  workspaceId: number | string,
  slug: string,
  excludeProviderId: string
): Promise<string | null> {
  const normalized = normalize_provider_link_slug(slug);
  if (!normalized) {
    return 'Provider link slug is required';
  }

  const { taken, error } = await collect_workspace_taken_provider_link_slugs(
    supabase,
    workspaceId,
    excludeProviderId
  );
  if (error) {
    return error;
  }

  if (!taken.has(normalized)) {
    return null;
  }

  const { data: eventTypeRow } = await supabase
    .from('event_types')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('slug', normalized)
    .maybeSingle();

  if (eventTypeRow) {
    return 'This link is already used by an event type in your workspace';
  }

  return 'This link is already used by another service provider';
}
