import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { findOrCreateContact } from '@/lib/contact-linking';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || null;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      invitee_name,
      invitee_email,
      invitee_phone,
      event_type_id,
      service_provider_id,
      department_id,
      additional_description,
    } = body;

    if (!invitee_name || !invitee_name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    const hostUserId = user.id;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const metadata: Record<string, unknown> = {
      source: 'emergency_booking',
      emergency_datetime: new Date().toISOString(),
      additional_description: additional_description != null && typeof additional_description === 'string' ? additional_description.trim() || null : null,
    };

    const contactId = await findOrCreateContact(
      supabase,
      workspaceId,
      invitee_name?.trim() ?? '',
      invitee_email?.trim() || null,
      invitee_phone?.trim() || null
    );

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        workspace_id: workspaceId,
        event_type_id: event_type_id != null ? String(event_type_id).trim() || null : null,
        service_provider_id: service_provider_id != null ? String(service_provider_id).trim() || null : null,
        department_id: department_id != null ? String(department_id).trim() || null : null,
        host_user_id: hostUserId,
        invitee_name: invitee_name.trim(),
        invitee_email: invitee_email?.trim() || null,
        invitee_phone: invitee_phone?.trim() || null,
        contact_id: contactId ?? null,
        start_at: new Date().toISOString(),
        end_at: new Date().toISOString(),
        status: 'emergency',
        location: null,
        payment_id: null,
        metadata,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating emergency booking:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
