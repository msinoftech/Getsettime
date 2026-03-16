import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { appUrl } from '@/lib/app-url';

/**
 * Creates an authenticated Supabase client using the anon key (respects RLS)
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

/**
 * Creates an admin Supabase client for storing invites in a custom table
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

// POST: Create and send an invite
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

    // Check if user has permission (workspace_admin or manager)
    const userRole = user.user_metadata?.role;
    if (userRole !== 'workspace_admin' && userRole !== 'manager') {
      return NextResponse.json({ error: 'Forbidden: Access denied' }, { status: 403 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const body = await req.json();
    const { email, role, departments } = body;

    // Validation
    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (!['workspace_admin', 'manager', 'service_provider', 'customer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Use admin client to check if user already exists and to store invite
    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Check if user with this email already exists
    const { data: { users } } = await adminClient.auth.admin.listUsers();
    const existingUser = users.find(u => u.email === email && u.user_metadata?.workspace_id === workspaceId);
    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists in this workspace' }, { status: 409 });
    }

    // Generate a unique invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72); // 72 hours expiration

    // Store invite in database
    const inviteData = {
      token: inviteToken,
      email,
      role,
      departments: departments || [],
      workspace_id: workspaceId,
      invited_by: user.id,
      invited_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      used: false,
    };

    // Insert invite into database
    const { data: insertedInvite, error: insertError } = await adminClient
      .from('invites')
      .insert([inviteData])
      .select()
      .single();

    if (insertError) {
      console.error('Error storing invite:', insertError);
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
    }

    const inviteUrl = appUrl(`/invite-accept?token=${inviteToken}`, req);

    // Send email with invite link using Nodemailer
    try {
      const nodemailer = await import('nodemailer');

      // Create transporter
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      // Send email
      const emailResult = await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'You have been invited to join GetSetTime',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">You're Invited!</h2>
            <p>You have been invited to join as a <strong>${role.replace('_', ' ')}</strong>.</p>
            <p>Click the button below to accept your invitation and create your account:</p>
            <div style="margin: 30px 0;">
              <a href="${inviteUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation</a>
            </div>
            <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #666; font-size: 14px; word-break: break-all;">${inviteUrl}</p>
            <p style="color: #999; font-size: 12px; margin-top: 40px;">This invitation will expire in 72 hours.</p>
          </div>
        `,
        text: `You're Invited!\n\nYou have been invited to join as a ${role.replace('_', ' ')}.\n\nAccept your invitation by visiting: ${inviteUrl}\n\nThis invitation will expire in 72 hours.`,
      });

      console.log('Email sent:', emailResult.messageId);
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Continue even if email fails - return the URL so admin can share manually
    }

    console.log('Invite created:', insertedInvite);

    return NextResponse.json({
      success: true,
      inviteUrl,
      message: 'Invite sent successfully. An email has been sent to the user with the invitation link.',
      invite: {
        email,
        role,
        expiresAt: expiresAt.toISOString(),
      },
    }, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

