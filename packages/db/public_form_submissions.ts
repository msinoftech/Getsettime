import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isValidSubscriberEmail,
  normalizeSubscriberEmail,
  sanitizeSubscriberSource,
} from './public_subscribers';

export const PUBLIC_FORM_TYPES = ['contact', 'solutions', 'claim_free'] as const;
export type public_form_type = (typeof PUBLIC_FORM_TYPES)[number];

const CONTROL_OR_NULL = /[\u0000-\u001F\u007F]/;

const MAX_NAME = 200;
const MAX_PHONE = 40;
const MAX_MESSAGE = 4000;
const MAX_META_SHORT = 500;
const MAX_META_LONG = 2000;
const MAX_SEARCH = 200;

export type public_form_submission_row = {
  id: number;
  form_type: public_form_type;
  name: string;
  email: string;
  phone: string;
  message: string | null;
  metadata: Record<string, unknown>;
  source: string | null;
  created_at: string;
};

export type list_public_form_submissions_params = {
  page: number;
  limit: number;
  q?: string;
  form_type?: public_form_type;
};

export type list_public_form_submissions_result = {
  submissions: public_form_submission_row[];
  total: number;
  page: number;
  limit: number;
};

function escapeIlikePattern(part: string): string {
  return part.replace(/[%_\\]/g, '\\$&');
}

function sanitizeText(value: unknown, maxLen: number, required: boolean): string | null {
  if (value == null || value === '') {
    return required ? null : null;
  }
  if (typeof value !== 'string') return required ? null : null;
  const trimmed = value.trim().replace(CONTROL_OR_NULL, '');
  if (!trimmed) return required ? null : null;
  return trimmed.slice(0, maxLen);
}

function optionalText(value: unknown, maxLen: number): string | null {
  const v = sanitizeText(value, maxLen, false);
  return v || null;
}

function requiredText(value: unknown, maxLen: number, field: string): string {
  const v = sanitizeText(value, maxLen, true);
  if (!v) throw new Error(`${field} is required`);
  return v;
}

function parseFormType(raw: unknown): public_form_type {
  if (typeof raw !== 'string' || !PUBLIC_FORM_TYPES.includes(raw as public_form_type)) {
    throw new Error('form_type must be contact, solutions, or claim_free');
  }
  return raw as public_form_type;
}

function buildContactMetadata(body: Record<string, unknown>) {
  return {
    profession: requiredText(body.profession, MAX_META_SHORT, 'profession'),
  };
}

function buildSolutionsMetadata(body: Record<string, unknown>) {
  return {
    business_name: requiredText(body.business_name, MAX_META_SHORT, 'business_name'),
    business_type: requiredText(body.business_type, MAX_META_SHORT, 'business_type'),
    team_size: optionalText(body.team_size, MAX_META_SHORT),
    current_booking_method: optionalText(body.current_booking_method, MAX_META_LONG),
    improvement_goals: optionalText(body.improvement_goals, MAX_META_LONG),
    additional_notes: optionalText(body.additional_notes, MAX_META_LONG),
  };
}

function buildClaimFreeMetadata(body: Record<string, unknown>) {
  return {
    business_name: requiredText(body.business_name, MAX_META_SHORT, 'business_name'),
    business_type: requiredText(body.business_type, MAX_META_SHORT, 'business_type'),
    website: optionalText(body.website, MAX_META_SHORT),
    country: requiredText(body.country, MAX_META_SHORT, 'country'),
    current_booking_method: requiredText(
      body.current_booking_method,
      MAX_META_LONG,
      'current_booking_method'
    ),
    staff_provider_count: requiredText(
      body.staff_provider_count,
      MAX_META_SHORT,
      'staff_provider_count'
    ),
    preferred_call_demo_time: requiredText(
      body.preferred_call_demo_time,
      MAX_META_LONG,
      'preferred_call_demo_time'
    ),
    main_services: requiredText(body.main_services, MAX_META_LONG, 'main_services'),
  };
}

export function parsePublicFormSubmission(
  body: Record<string, unknown>
): Omit<public_form_submission_row, 'id' | 'created_at' | 'source'> {
  const form_type = parseFormType(body.form_type);

  const name = requiredText(body.name, MAX_NAME, 'name');
  const emailRaw = typeof body.email === 'string' ? normalizeSubscriberEmail(body.email) : '';
  if (!isValidSubscriberEmail(emailRaw)) throw new Error('Valid email is required');
  const phone = requiredText(body.phone, MAX_PHONE, 'phone');

  let message: string | null = null;
  let metadata: Record<string, unknown> = {};

  switch (form_type) {
    case 'contact':
      message = requiredText(body.message, MAX_MESSAGE, 'message');
      metadata = buildContactMetadata(body);
      break;
    case 'solutions':
      metadata = buildSolutionsMetadata(body);
      break;
    case 'claim_free':
      metadata = buildClaimFreeMetadata(body);
      break;
    default:
      throw new Error('Invalid form_type');
  }

  return {
    form_type,
    name,
    email: emailRaw,
    phone,
    message,
    metadata,
  };
}

export async function submitPublicForm(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  source?: string | null
): Promise<{ id: number }> {
  const row = parsePublicFormSubmission(body);
  const safeSource = sanitizeSubscriberSource(source);

  const { data, error } = await supabase
    .from('public_form_submissions')
    .insert({
      form_type: row.form_type,
      name: row.name,
      email: row.email,
      phone: row.phone,
      message: row.message,
      metadata: row.metadata,
      source: safeSource,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Failed to save form submission');
  return { id: Number(data.id) };
}

export function sanitizeFormSubmissionSearch(value: string): string {
  return value
    .trim()
    .replace(CONTROL_OR_NULL, '')
    .slice(0, MAX_SEARCH);
}

export async function listPublicFormSubmissions(
  supabase: SupabaseClient,
  params: list_public_form_submissions_params
): Promise<list_public_form_submissions_result> {
  const page = Math.max(1, params.page);
  const limit = Math.min(100, Math.max(1, params.limit));
  const offset = (page - 1) * limit;

  let query = supabase
    .from('public_form_submissions')
    .select(
      'id, form_type, name, email, phone, message, metadata, source, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false });

  if (params.form_type) {
    query = query.eq('form_type', params.form_type);
  }

  const q = params.q ? sanitizeFormSubmissionSearch(params.q) : '';
  if (q) {
    const pattern = `%${escapeIlikePattern(q)}%`;
    query = query.or(
      [
        `name.ilike.${pattern}`,
        `email.ilike.${pattern}`,
        `phone.ilike.${pattern}`,
        `message.ilike.${pattern}`,
        `metadata_text.ilike.${pattern}`,
      ].join(',')
    );
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  const submissions: public_form_submission_row[] = (data ?? []).map((row) => ({
    id: Number(row.id),
    form_type: row.form_type as public_form_type,
    name: String(row.name),
    email: String(row.email),
    phone: String(row.phone),
    message: row.message != null ? String(row.message) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    source: row.source != null ? String(row.source) : null,
    created_at: String(row.created_at),
  }));

  return {
    submissions,
    total: count ?? 0,
    page,
    limit,
  };
}