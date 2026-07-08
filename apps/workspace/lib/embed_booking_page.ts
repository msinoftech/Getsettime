import { createSupabaseClient, createSupabaseServerClient } from '@app/db';
import { find_provider_id_by_link_slug } from '@/lib/provider_booking_link';

export type embed_workspace_row = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  created_at: string;
};

export type embed_event_type_row = {
  id: string;
  title: string;
  slug: string;
  duration_minutes: number | null;
  owner_id?: string | null;
};

export async function get_embed_workspace_by_slug(
  slug: string
): Promise<embed_workspace_row | null> {
  try {
    let supabase = createSupabaseClient();
    const decodedSlug = decodeURIComponent(slug);

    const { data, error } = await supabase
      .from('workspaces')
      .select('id, name, slug, logo_url, created_at')
      .eq('slug', decodedSlug)
      .single();

    if (error) {
      if (
        error.code === '42501' ||
        error.message?.includes('permission') ||
        error.message?.includes('policy')
      ) {
        supabase = createSupabaseServerClient();
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('workspaces')
          .select('id, name, slug, logo_url, created_at')
          .eq('slug', decodedSlug)
          .single();

        if (!fallbackError && fallbackData) {
          return fallbackData as embed_workspace_row;
        }
      }

      if (error.code === 'PGRST116') {
        const { data: caseInsensitiveData, error: caseError } = await supabase
          .from('workspaces')
          .select('id, name, slug, logo_url, created_at')
          .ilike('slug', decodedSlug)
          .single();

        if (!caseError && caseInsensitiveData) {
          return caseInsensitiveData as embed_workspace_row;
        }

        const serverSupabase = createSupabaseServerClient();
        const { data: serverData, error: serverError } = await serverSupabase
          .from('workspaces')
          .select('id, name, slug, logo_url, created_at')
          .eq('slug', decodedSlug)
          .single();

        if (!serverError && serverData) {
          return serverData as embed_workspace_row;
        }

        const { data: serverCaseData, error: serverCaseError } =
          await serverSupabase
            .from('workspaces')
            .select('id, name, slug, logo_url, created_at')
            .ilike('slug', decodedSlug)
            .single();

        if (!serverCaseError && serverCaseData) {
          return serverCaseData as embed_workspace_row;
        }
      }

      return null;
    }

    return (data as embed_workspace_row | null) ?? null;
  } catch (err) {
    console.error('Exception in get_embed_workspace_by_slug:', err);
    return null;
  }
}

export async function get_embed_event_type_by_slug(
  workspaceId: string,
  eventTypeSlug: string
): Promise<embed_event_type_row | null> {
  try {
    const supabase = createSupabaseServerClient();
    const decodedSlug = decodeURIComponent(eventTypeSlug);

    const { data, error } = await supabase
      .from('event_types')
      .select('id, title, slug, duration_minutes, owner_id, status')
      .eq('workspace_id', workspaceId)
      .eq('slug', decodedSlug)
      .eq('status', 'active')
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as embed_event_type_row;
  } catch (err) {
    console.error('Exception in get_embed_event_type_by_slug:', err);
    return null;
  }
}

export async function get_embed_service_provider_id_by_link_slug(
  workspaceId: string,
  linkSlug: string
): Promise<string | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('configurations')
      .select('settings')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (error || !data?.settings) {
      return null;
    }

    return find_provider_id_by_link_slug(
      (data.settings as { links?: unknown }).links,
      linkSlug
    );
  } catch (err) {
    console.error('Exception in get_embed_service_provider_id_by_link_slug:', err);
    return null;
  }
}
