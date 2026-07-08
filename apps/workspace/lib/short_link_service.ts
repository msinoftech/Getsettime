import { randomBytes } from 'crypto';
import { createSupabaseServerClient } from '@app/db';
import { get_public_booking_origin } from '@/src/utils/public_booking_link';
import type { short_links } from '@/src/types/short_links';

const SHORT_CODE_LENGTH = 8;
const SHORT_CODE_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const SHORT_CODE_PATTERN = /^[A-Za-z0-9]{8}$/;
const MAX_INSERT_RETRIES = 8;

export type get_or_create_short_link_input = {
  workspace_id: number;
  original_url: string;
  created_by?: string | null;
  link_type?: string;
};

export type get_or_create_short_link_result = {
  short_code: string;
  short_url: string;
  original_url: string;
  reused: boolean;
};

export function generate_short_code(length = SHORT_CODE_LENGTH): string {
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += SHORT_CODE_CHARS[bytes[i] % SHORT_CODE_CHARS.length];
  }
  return result;
}

export function is_valid_short_code(segment: string): boolean {
  return SHORT_CODE_PATTERN.test(segment);
}

export function build_short_url(short_code: string): string {
  const trimmed = short_code.trim();
  return `${get_public_booking_origin()}/${trimmed}`;
}

export function assert_same_origin_url(url: string): void {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('URL is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid URL');
  }

  const allowed_origin = get_public_booking_origin();
  if (parsed.origin !== allowed_origin) {
    throw new Error('URL must belong to this application');
  }
}

export async function resolve_short_link_by_code(
  code: string
): Promise<string | null> {
  if (!is_valid_short_code(code)) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('short_links')
    .select('original_url')
    .eq('short_code', code)
    .maybeSingle();

  if (error || !data?.original_url) {
    return null;
  }

  try {
    assert_same_origin_url(data.original_url);
  } catch {
    return null;
  }

  return data.original_url;
}

export async function get_or_create_short_link(
  input: get_or_create_short_link_input
): Promise<get_or_create_short_link_result> {
  const original_url = input.original_url.trim();
  assert_same_origin_url(original_url);

  const supabase = createSupabaseServerClient();

  const { data: existing, error: lookup_error } = await supabase
    .from('short_links')
    .select('short_code, original_url')
    .eq('workspace_id', input.workspace_id)
    .eq('original_url', original_url)
    .maybeSingle();

  if (lookup_error) {
    throw new Error(lookup_error.message || 'Failed to look up short link');
  }

  if (existing?.short_code) {
    return {
      short_code: existing.short_code,
      short_url: build_short_url(existing.short_code),
      original_url: existing.original_url,
      reused: true,
    };
  }

  const link_type = input.link_type?.trim() || 'public_booking';

  for (let attempt = 0; attempt < MAX_INSERT_RETRIES; attempt += 1) {
    const short_code = generate_short_code();
    const row: Pick<
      short_links,
      'workspace_id' | 'short_code' | 'original_url' | 'link_type' | 'created_by'
    > = {
      workspace_id: input.workspace_id,
      short_code,
      original_url,
      link_type,
      created_by: input.created_by ?? null,
    };

    const { data: inserted, error: insert_error } = await supabase
      .from('short_links')
      .insert(row)
      .select('short_code, original_url')
      .single();

    if (!insert_error && inserted) {
      return {
        short_code: inserted.short_code,
        short_url: build_short_url(inserted.short_code),
        original_url: inserted.original_url,
        reused: false,
      };
    }

    if (insert_error?.code === '23505') {
      const constraint = insert_error.message ?? '';
      if (constraint.includes('short_links_workspace_original_unique')) {
        const { data: raced } = await supabase
          .from('short_links')
          .select('short_code, original_url')
          .eq('workspace_id', input.workspace_id)
          .eq('original_url', original_url)
          .maybeSingle();

        if (raced?.short_code) {
          return {
            short_code: raced.short_code,
            short_url: build_short_url(raced.short_code),
            original_url: raced.original_url,
            reused: true,
          };
        }
      }
      continue;
    }

    throw new Error(insert_error?.message || 'Failed to create short link');
  }

  throw new Error('Failed to generate a unique short code');
}
