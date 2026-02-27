import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client for public invite validation
 */
function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// GET: Validate an invite token
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const supabase = createSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Fetch invite from database
    const { data: invite, error: fetchError } = await supabase
      .from('invites')
      .select('*')
      .eq('token', token)
      .single();

    if (fetchError || !invite) {
      console.error('Error fetching invite:', fetchError);
      return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 });
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invite has expired' }, { status: 400 });
    }

    // Check if already used
    if (invite.used) {
      return NextResponse.json({ error: 'Invite has already been used' }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      email: invite.email,
      role: invite.role,
      departments: invite.departments,
      workspace_id: invite.workspace_id,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

