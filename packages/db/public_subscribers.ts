import type { SupabaseClient } from '@supabase/supabase-js';

/** RFC 5321 practical max; keeps storage and parsers bounded. */
export const MAX_SUBSCRIBER_EMAIL_LENGTH = 254;

export const MAX_SUBSCRIBER_SOURCE_LENGTH = 200;

/** Local + domain after normalize (lowercase ASCII subscribe flow). */
const EMAIL_PATTERN =
  /^[a-z0-9](?:[a-z0-9._%+\-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9.\-]*[a-z0-9])?\.[a-z]{2,63}$/;

const CONTROL_OR_NULL = /[\u0000-\u001F\u007F]/;

export class PublicSubscriberDuplicateError extends Error {
  constructor() {
    super('This email is already subscribed.');
    this.name = 'PublicSubscriberDuplicateError';
  }
}

export function normalizeSubscriberEmail(value: string): string {
  return value.trim().toLowerCase();
}

function emailHasDisallowedCharacters(email: string): boolean {
  if (!email || email.length > MAX_SUBSCRIBER_EMAIL_LENGTH) return true;
  if (CONTROL_OR_NULL.test(email)) return true;
  if (/[<>('"\\;`]/.test(email)) return true;
  if (email.includes('..')) return true;
  return false;
}

export function isValidSubscriberEmail(email: string): boolean {
  if (!email) return false;
  if (emailHasDisallowedCharacters(email)) return false;
  return EMAIL_PATTERN.test(email);
}

/** Strip control chars and cap length for optional `source` metadata. */
export function sanitizeSubscriberSource(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withoutControl = trimmed.replace(CONTROL_OR_NULL, '');
  const capped = withoutControl.slice(0, MAX_SUBSCRIBER_SOURCE_LENGTH);
  return capped || null;
}

/** Insert one subscriber email; rejects duplicates. Uses parameterized Supabase insert (no raw SQL). */
export async function addPublicSubscriber(
  supabase: SupabaseClient,
  email: string,
  source?: string | null
): Promise<{ email: string }> {
  const norm = normalizeSubscriberEmail(email);
  if (!isValidSubscriberEmail(norm)) {
    throw new Error('Valid email is required');
  }

  const safeSource = sanitizeSubscriberSource(source);

  const { data, error } = await supabase
    .from('public_subscribers')
    .insert({
      email: norm,
      source: safeSource,
    })
    .select('email')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new PublicSubscriberDuplicateError();
    }
    throw new Error(error.message);
  }

  if (!data) throw new Error('Failed to save subscriber');
  return { email: String(data.email) };
}

export type public_subscriber_row = {
  id: number;
  email: string;
  created_at: string;
  source: string | null;
};

export type list_public_subscribers_params = {
  page: number;
  limit: number;
  email?: string;
};

export type list_public_subscribers_result = {
  subscribers: public_subscriber_row[];
  total: number;
  page: number;
  limit: number;
};

function escapeIlikePattern(part: string): string {
  return part.replace(/[%_\\]/g, '\\$&');
}

/** Partial email filter for superadmin listing (not full RFC validation). */
export function sanitizeSubscriberEmailFilter(value: string): string {
  return normalizeSubscriberEmail(value)
    .replace(CONTROL_OR_NULL, '')
    .replace(/[<>('"\\;`]/g, '')
    .slice(0, MAX_SUBSCRIBER_EMAIL_LENGTH);
}

export async function listPublicSubscribers(
  supabase: SupabaseClient,
  params: list_public_subscribers_params
): Promise<list_public_subscribers_result> {
  const page = Math.max(1, params.page);
  const limit = Math.min(100, Math.max(1, params.limit));
  const offset = (page - 1) * limit;

  let query = supabase
    .from('public_subscribers')
    .select('id, email, created_at, source', { count: 'exact' })
    .order('created_at', { ascending: false });

  const emailFilter = params.email ? sanitizeSubscriberEmailFilter(params.email) : '';
  if (emailFilter) {
    query = query.ilike('email', `%${escapeIlikePattern(emailFilter)}%`);
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  const subscribers: public_subscriber_row[] = (data ?? []).map((row) => ({
    id: Number(row.id),
    email: String(row.email),
    created_at: String(row.created_at),
    source: row.source != null ? String(row.source) : null,
  }));

  return {
    subscribers,
    total: count ?? 0,
    page,
    limit,
  };
}