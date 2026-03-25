import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';
import { createClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveAuthenticatedCustomer(req: NextRequest): Promise<{ email: string | null; phone: string | null } | null> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '').trim();
  if (!token || UUID_RE.test(token)) return null;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;
  if (user.user_metadata?.role !== 'customer') return null;

  return {
    email: user.email || user.user_metadata?.email || null,
    phone: user.user_metadata?.phone || user.phone || null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '').trim() || '';

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseServerClient();

    const customerAuth = await resolveAuthenticatedCustomer(req);

    let phoneE164: string | null = null;
    let customerEmail: string | null = null;

    if (customerAuth) {
      phoneE164 = customerAuth.phone;
      customerEmail = customerAuth.email;
      if (!phoneE164 && !customerEmail) {
        return NextResponse.json({ error: 'No phone or email associated with your account.' }, { status: 400 });
      }
    } else {
      if (!UUID_RE.test(token)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { data: session, error: sessionError } = await supabase
        .from('phone_verification_sessions')
        .select('phone_e164, expires_at')
        .eq('token', token)
        .single();

      if (sessionError || !session) {
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

      phoneE164 = session.phone_e164;
    }

    const phoneDigits = phoneE164?.replace(/\D/g, '') || '';

    const phoneMatches = (value: string | null): boolean => {
      if (!value || !phoneDigits) return false;
      if (value === phoneE164) return true;
      const valueDigits = value.replace(/\D/g, '');
      if (!valueDigits) return false;
      if (valueDigits === phoneDigits) return true;
      return phoneDigits.endsWith(valueDigits) || valueDigits.endsWith(phoneDigits);
    };

    const emailMatches = (value: string | null): boolean => {
      if (!value || !customerEmail) return false;
      return value.toLowerCase() === customerEmail.toLowerCase();
    };

    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, phone, email')
      .or('phone.not.is.null,email.not.is.null');

    const contactIds = (contacts || [])
      .filter((c) => phoneMatches(c.phone) || emailMatches(c.email))
      .map((c) => c.id);

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

    const seenIds = new Set<string>();
    const filtered = (bookings || []).filter((b) => {
      const byPhone = phoneMatches(b.invitee_phone);
      const byEmail = emailMatches(b.invitee_email);
      const byContact = b.contact_id != null && contactIds.includes(b.contact_id);
      if (!byPhone && !byEmail && !byContact) return false;
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
