import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    const body = await req.json();
    const { name, email, phone, city, state, country } = body;

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
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating contact:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

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

    const body = await req.json();
    const { id, name, email, phone, city, state, country } = body;

    if (!id) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('contacts')
      .update({
        name: name.trim(),
        email: email.trim(),
        phone: phone?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        country: country?.trim() || null,
      })
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

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
