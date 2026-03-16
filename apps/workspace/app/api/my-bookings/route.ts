import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '').trim() || '';

    if (!token || !UUID_RE.test(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseServerClient();

    // Validate session token and resolve verified phone
    const { data: session, error: sessionError } = await supabase
      .from('phone_verification_sessions')
      .select('phone_e164, expires_at')
      .eq('token', token)
      .single();

    if (sessionError || !session) {
      console.error('[my-bookings] Session lookup failed:', {
        code: sessionError?.code,
        message: sessionError?.message,
      });
      return NextResponse.json(
        { error: 'Session expired. Please verify your phone again.' },
        { status: 401 }
      );
    }

    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Session expired. Please verify your phone again.' },
        { status: 401 }
      );
    }

    const phoneE164 = session.phone_e164;
    const phoneDigits = phoneE164.replace(/\D/g, '');

    const phoneMatches = (value: string | null): boolean => {
      if (!value) return false;
      if (value === phoneE164) return true;
      const valueDigits = value.replace(/\D/g, '');
      if (!valueDigits) return false;
      if (valueDigits === phoneDigits) return true;
      // Suffix match handles local numbers vs E.164 (e.g. "9915712311" vs "919915712311")
      return phoneDigits.endsWith(valueDigits) || valueDigits.endsWith(phoneDigits);
    };

    // 1. Find contact IDs whose phone matches the verified number
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, phone')
      .not('phone', 'is', null);

    const contactIds = (contacts || [])
      .filter((c) => phoneMatches(c.phone))
      .map((c) => c.id);

    // 2. Fetch bookings by invitee_phone OR by contact_id
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(
        'id, workspace_id, contact_id, invitee_name, invitee_email, invitee_phone, start_at, end_at, status, created_at, event_types(title), contacts(name, phone, email)'
      )
      .order('start_at', { ascending: false });

    if (bookingsError) {
      console.error('[my-bookings] Bookings query error:', {
        code: bookingsError.code,
        message: bookingsError.message,
      });
      return NextResponse.json(
        { error: 'Failed to fetch bookings' },
        { status: 500 }
      );
    }

    // Match by invitee_phone OR by contact_id linked to this phone
    const seenIds = new Set<string>();
    const filtered = (bookings || []).filter((b) => {
      const byPhone = phoneMatches(b.invitee_phone);
      const byContact = b.contact_id != null && contactIds.includes(b.contact_id);
      if (!byPhone && !byContact) return false;
      if (seenIds.has(String(b.id))) return false;
      seenIds.add(String(b.id));
      return true;
    });

    // Resolve workspace names
    const workspaceIds = [
      ...new Set(filtered.map((b) => b.workspace_id).filter(Boolean)),
    ];

    let workspaceMap: Record<string, string> = {};
    if (workspaceIds.length > 0) {
      const { data: workspaces } = await supabase
        .from('workspaces')
        .select('id, name')
        .in('id', workspaceIds);

      if (workspaces) {
        workspaceMap = Object.fromEntries(
          workspaces.map((w) => [String(w.id), w.name])
        );
      }
    }

    const matched = filtered.map((b) => {
      const contact = b.contacts as unknown as { name: string | null; phone: string | null; email: string | null } | null;
      return {
        id: b.id,
        invitee_name: b.invitee_name || contact?.name || null,
        invitee_email: b.invitee_email || contact?.email || null,
        invitee_phone: b.invitee_phone || contact?.phone || null,
        start_at: b.start_at,
        end_at: b.end_at,
        status: b.status,
        created_at: b.created_at,
        event_type_title:
          (b.event_types as unknown as { title: string } | null)?.title || null,
        workspace_name: workspaceMap[String(b.workspace_id)] || null,
      };
    });

    // Server-side pagination
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const total = matched.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginated = matched.slice(offset, offset + limit);

    return NextResponse.json({
      data: paginated,
      pagination: { page, limit, total, totalPages },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[my-bookings] Error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
