import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  normalizeDepartmentIdArray,
  normalizeStringArray,
} from '@/lib/invite_department_assignment';
import { replaceUserDepartmentsForWorkspaceUser } from '@/lib/user_workspace_assignments';

/**
 * Creates an admin Supabase client for user creation
 */
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
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

    const deptIds = normalizeDepartmentIdArray(invite.departments);
    const deptNamesPending = normalizeStringArray(invite.department_names);

    const inviteWorkspaceId = Number(invite.workspace_id);
    if (!Number.isFinite(inviteWorkspaceId) || inviteWorkspaceId <= 0) {
      return NextResponse.json({ error: 'Invalid workspace on invite' }, { status: 500 });
    }

    const inviteRole =
      typeof invite.role === 'string' && invite.role.trim() !== ''
        ? invite.role.trim()
        : 'service_provider';

    const inviteName =
      typeof invite.name === 'string' ? invite.name.trim() : '';
    if (!inviteName) {
      return NextResponse.json(
        {
          error:
            'This invite is missing your name. Ask your workspace admin to send a new invitation.',
        },
        { status: 400 }
      );
    }

    const invitePhone =
      typeof invite.phone === 'string' ? invite.phone.trim() : '';

    const userMetadata: Record<string, unknown> = {
      name: inviteName,
      role: inviteRole,
      workspace_id: inviteWorkspaceId,
      invited_at: new Date().toISOString(),
      ...(invitePhone !== '' ? { phone: invitePhone } : {}),
    };
    if (inviteRole === 'service_provider') {
      userMetadata.onboarding_completed = false;
      userMetadata.onboarding_last_completed_step = 0;
    } else if (inviteRole === 'staff' || inviteRole === 'manager') {
      // Internal team: no provider onboarding wizard after accept.
      userMetadata.onboarding_completed = true;
    }

    if (inviteRole === 'service_provider') {
      if (deptIds.length > 0) {
        userMetadata.pending_department_ids = deptIds;
      }
      if (deptNamesPending.length > 0) {
        userMetadata.pending_department_names = deptNamesPending;
      }
    }

    // Create user with metadata from invite
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    if (!newUser.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    const createdMeta = newUser.user.user_metadata as Record<string, unknown> | undefined;
    const createdWs = createdMeta?.workspace_id;
    if (Number(createdWs) !== inviteWorkspaceId) {
      const { error: metaFixErr } = await adminClient.auth.admin.updateUserById(newUser.user.id, {
        user_metadata: userMetadata,
      });
      if (metaFixErr) {
        console.error('invites accept metadata fix:', metaFixErr);
        return NextResponse.json({ error: metaFixErr.message }, { status: 500 });
      }
    }

    // Staff/manager: assign departments immediately. Service providers defer until onboarding step 1.
    if (inviteRole !== 'service_provider' && deptIds.length > 0) {
      const { error: udErr } = await replaceUserDepartmentsForWorkspaceUser(
        adminClient,
        inviteWorkspaceId,
        newUser.user.id,
        deptIds
      );
      if (udErr) {
        console.error('invites accept user_departments:', udErr);
        return NextResponse.json(
          { error: udErr.message || 'Failed to assign departments to user' },
          { status: 500 }
        );
      }
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
        workspace_id: inviteWorkspaceId,
      },
    }, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

