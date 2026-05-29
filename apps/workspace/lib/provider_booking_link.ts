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

  const { data: eventTypeRow } = await supabase
    .from('event_types')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('slug', normalized)
    .maybeSingle();

  if (eventTypeRow) {
    return 'This link is already used by an event type in your workspace';
  }

  const { data: configRow } = await supabase
    .from('configurations')
    .select('settings')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  const links = parse_workspace_provider_links(
    (configRow?.settings as { links?: unknown } | undefined)?.links
  );

  for (const [providerId, entry] of Object.entries(links)) {
    if (providerId !== excludeProviderId && entry.slug === normalized) {
      return 'This link is already used by another service provider';
    }
  }

  return null;
}
