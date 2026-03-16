import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Creates an authenticated Supabase client using the anon key (respects RLS)
 * Sets the auth session from the request's bearer token
 */
function createAuthenticatedClient(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  // Create client with anon key - respects RLS policies
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  return { supabase, token };
}

export async function GET(req: NextRequest) {
  try {
    const result = createAuthenticatedClient(req);
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, token } = result;

    // Verify auth - will fail if token is invalid
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // RLS automatically filters by workspace_id and owner_id from JWT
    const { data, error } = await supabase
      .from('event_types')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching event types:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    console.error('Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = createAuthenticatedClient(req);
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, token } = result;

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, duration_minutes } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    // RLS validates workspace_id matches JWT; we provide it for INSERT WITH CHECK policy
    const { data, error } = await supabase
      .from('event_types')
      .insert({
        workspace_id: workspaceId,
        owner_id: user.id,
        title: title.trim(),
        slug: title.toLowerCase().replace(/\s+/g, '-'),
        duration_minutes: duration_minutes && duration_minutes.toString().trim() ? parseInt(duration_minutes.toString(), 10) : null,
        buffer_before: null,
        buffer_after: null,
        location_type: null,
        location_value: null,
        is_public: false,
        settings: null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating event type:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const result = createAuthenticatedClient(req);
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, token } = result;

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, duration_minutes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Event type ID is required' }, { status: 400 });
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // RLS automatically filters by workspace_id and owner_id from JWT
    const { data, error } = await supabase
      .from('event_types')
      .update({
        title: title.trim(),
        slug: title.toLowerCase().replace(/\s+/g, '-'),
        duration_minutes: duration_minutes && duration_minutes.toString().trim() ? parseInt(duration_minutes.toString(), 10) : null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating event type:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Event type not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const result = createAuthenticatedClient(req);
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, token } = result;

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Event type ID is required' }, { status: 400 });
    }

    // RLS automatically filters by workspace_id and owner_id from JWT
    const { error } = await supabase
      .from('event_types')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting event type:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

