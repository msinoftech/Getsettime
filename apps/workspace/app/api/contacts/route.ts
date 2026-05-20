import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { appendActivityLog } from '@/lib/activity-log';

const CONTACT_SOURCE_VALUES = ['Manual', 'Booking', 'Website'] as const;

function parse_contact_metadata_patch(
  body: Record<string, unknown>
): Partial<{ source: string; notes: string }> {
  const patch: Partial<{ source: string; notes: string }> = {};

  if ('source' in body && typeof body.source === 'string') {
    const s = body.source.trim();
    if ((CONTACT_SOURCE_VALUES as readonly string[]).includes(s)) {
      patch.source = s;
    }
  }

  if ('notes' in body && typeof body.notes === 'string') {
    patch.notes = body.notes;
  }

  return patch;
}

function merge_contact_metadata(
  existing: unknown,
  patch: Partial<{ source: string; notes: string }>
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};

  if (patch.source !== undefined) {
    base.source = patch.source;
  }

  if (patch.notes !== undefined) {
    base.notes = patch.notes;
  }

  return base;
}

function createAuthenticatedClient(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(req);
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contacts:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ contacts: data || [] });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(req);
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const bodyRaw = await req.json();
    const body = bodyRaw as Record<string, unknown>;
    const { name, email, phone, city, state, country } = bodyRaw as {
      name?: string;
      email?: string;
      phone?: string | null;
      city?: string | null;
      state?: string | null;
      country?: string | null;
    };

    const metadataPatch = parse_contact_metadata_patch(body);
    const metadata =
      Object.keys(metadataPatch).length > 0
        ? merge_contact_metadata(null, metadataPatch)
        : {};
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        workspace_id: workspaceId,
        name: name.trim(),
        email: email.trim(),
        phone: phone?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        country: country?.trim() || null,
        metadata,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating contact:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await appendActivityLog(workspaceId, {
      type: 'contact',
      action: 'created',
      title: 'Contact created',
      description: `${data?.name || name.trim()}${data?.email ? ` (${data.email})` : ''}`,
    });

    return NextResponse.json({ contact: data });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(req);
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyRaw = await req.json();
    const body = bodyRaw as Record<string, unknown>;
    const { id, name, email, phone, city, state, country } = bodyRaw as {
      id?: number;
      name?: string;
      email?: string;
      phone?: string | null;
      city?: string | null;
      state?: string | null;
      country?: string | null;
    };

    if (!id) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const metadataPatch = parse_contact_metadata_patch(body);

    const { data: prevRow } = await supabase
      .from('contacts')
      .select('metadata')
      .eq('id', id)
      .maybeSingle();

    const updatePayload: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() || null,
      city: city?.trim() || null,
      state: state?.trim() || null,
      country: country?.trim() || null,
    };

    if (Object.keys(metadataPatch).length > 0) {
      updatePayload.metadata = merge_contact_metadata(prevRow?.metadata, metadataPatch);
    }

    const { data, error } = await supabase
      .from('contacts')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating contact:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Contact not found or unauthorized' }, { status: 404 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (workspaceId) {
      await appendActivityLog(workspaceId, {
        type: 'contact',
        action: 'updated',
        title: 'Contact updated',
        description: `${data?.name || name.trim()}${data?.email ? ` (${data.email})` : ''}`,
      });
    }

    return NextResponse.json({ contact: data });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(req);
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting contact:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (workspaceId) {
      await appendActivityLog(workspaceId, {
        type: 'contact',
        action: 'deleted',
        title: 'Contact deleted',
        description: `Contact ID ${id} was removed`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
