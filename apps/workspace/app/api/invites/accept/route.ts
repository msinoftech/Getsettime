import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Creates an admin Supabase client for user creation
 */
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// POST: Accept an invite and create user
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password, name } = body;

    // Validation
    if (!token || !password || !name) {
      return NextResponse.json({ error: 'Token, password, and name are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Use admin client to fetch and update invite
    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Fetch invite from database
    const { data: invite, error: fetchError } = await adminClient
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

    // Check if user already exists
    const { data: { users } } = await adminClient.auth.admin.listUsers();
    const existingUser = users.find(u => u.email === invite.email);
    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    // Create user with metadata from invite
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: invite.role,
        workspace_id: invite.workspace_id,
        departments: invite.departments || [],
        invited_at: new Date().toISOString(),
      },
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    if (!newUser.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // Mark invite as used in database
    const { error: updateError } = await adminClient
      .from('invites')
      .update({ 
        used: true, 
        used_at: new Date().toISOString() 
      })
      .eq('token', token);

    if (updateError) {
      console.error('Error marking invite as used:', updateError);
      // Don't fail the request, user is already created
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully. You can now log in.',
      user: {
        email: newUser.user.email,
        name: newUser.user.user_metadata?.name,
        role: newUser.user.user_metadata?.role,
      },
    }, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

