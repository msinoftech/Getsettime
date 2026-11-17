import { NextRequest, NextResponse } from 'next/server';
import {
  listPublicFormSubmissions,
  PUBLIC_FORM_TYPES,
  type public_form_type,
} from '@app/db/public_form_submissions';
import { getSupabaseServer } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const q = searchParams.get('q')?.trim() ?? '';
    const formTypeRaw = searchParams.get('form_type')?.trim() ?? '';
    const form_type = PUBLIC_FORM_TYPES.includes(formTypeRaw as public_form_type)
      ? (formTypeRaw as public_form_type)
      : undefined;

    const result = await listPublicFormSubmissions(supabase, {
      page,
      limit,
      q: q || undefined,
      form_type,
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('GET /api/public-form-submissions error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}