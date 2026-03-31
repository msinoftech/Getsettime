import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sendConfirmationEmail } from '@/lib/email-service';

function normalize_auth_email(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

function signup_user_metadata(name: string) {
  return {
    name,
    role: 'workspace_admin' as const,
    signup_method: 'password',
    onboarding_completed: false,
    onboarding_last_completed_step: 0,
  };
}

function is_duplicate_user_error(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('already registered') ||
    m.includes('already exists') ||
    m.includes('user already registered') ||
    m.includes('database error saving new user')
  );
}

async function send_magiclink_confirmation(params: {
  supabaseAdmin: SupabaseClient;
  normalizedEmail: string;
  name: string;
  redirectTo: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { supabaseAdmin, normalizedEmail, name, redirectTo } = params;
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: normalizedEmail,
    options: { redirectTo },
  });

  if (linkError) {
    console.error('generateLink (magiclink) error', linkError);
    const msg = linkError.message ?? '';
    if (is_duplicate_user_error(msg)) {
      return { ok: false, status: 409, error: 'This email is already registered. Please login instead.' };
    }
    return { ok: false, status: 400, error: msg || 'Failed to generate confirmation link.' };
  }

  const actionLink = linkData?.properties?.action_link;
  if (!actionLink || typeof actionLink !== 'string') {
    console.error('No action_link in generateLink response', linkData);
    return { ok: false, status: 500, error: 'Failed to generate confirmation link' };
  }

  try {
    await sendConfirmationEmail(normalizedEmail, name, actionLink);
  } catch (emailErr) {
    console.error('Failed to send confirmation email:', emailErr);
    return {
      ok: false,
      status: 500,
      error:
        'Account created but we could not send the confirmation email. Check SMTP settings (SMTP_USER, SMTP_PASSWORD, SMTP_HOST).',
    };
  }

  return { ok: true };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email: rawEmail, password, name } = body;
    const normalizedEmail = normalize_auth_email(rawEmail);

    if (!normalizedEmail || !password || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || (typeof req.url === 'string' && req.url.startsWith('http') ? new URL(req.url).origin : '') || '';
    const redirectTo = `${origin.replace(/\/$/, '')}/login?email_verified=1&email=${encodeURIComponent(normalizedEmail)}`;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const displayName = name.trim();
    const meta = signup_user_metadata(displayName);

    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 });
    const existingUser = listData?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);

    if (existingUser?.email_confirmed_at) {
      return NextResponse.json(
        { error: 'This email is already registered. Please login instead.' },
        { status: 409 }
      );
    }

    if (existingUser && !existingUser.email_confirmed_at) {
      const existingMeta = (existingUser.user_metadata as Record<string, unknown> | undefined) ?? {};
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password,
        user_metadata: { ...existingMeta, ...meta },
      });
      if (updateError) {
        console.error('updateUser (unconfirmed resend) error', updateError);
        const um = updateError.message ?? '';
        if (um.includes('Password')) {
          return NextResponse.json({ error: 'Password does not meet requirements. Please use a stronger password.' }, { status: 400 });
        }
        return NextResponse.json({ error: um || 'Failed to update account. Please try again.' }, { status: 400 });
      }

      const sent = await send_magiclink_confirmation({
        supabaseAdmin,
        normalizedEmail,
        name: displayName,
        redirectTo,
      });
      if (!sent.ok) {
        return NextResponse.json({ error: sent.error }, { status: sent.status });
      }

      return NextResponse.json(
        {
          user: { id: existingUser.id, email: normalizedEmail },
          message:
            'Check your email to confirm your account, then sign in on the login page with your password.',
        },
        { status: 201 }
      );
    }

    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: false,
      user_metadata: meta,
    });

    if (createError) {
      console.error('createUser error', createError);
      const msg = createError.message ?? '';
      if (msg.includes('Password')) {
        return NextResponse.json({ error: 'Password does not meet requirements. Please use a stronger password.' }, { status: 400 });
      }
      if (is_duplicate_user_error(msg)) {
        return NextResponse.json({ error: 'This email is already registered. Please login instead.' }, { status: 409 });
      }
      return NextResponse.json({ error: msg || 'Failed to create user. Please try again.' }, { status: 400 });
    }

    const sent = await send_magiclink_confirmation({
      supabaseAdmin,
      normalizedEmail,
      name: displayName,
      redirectTo,
    });
    if (!sent.ok) {
      return NextResponse.json({ error: sent.error }, { status: sent.status });
    }

    return NextResponse.json({
      user: createData.user ?? { id: '', email: normalizedEmail },
      message: 'Check your email to confirm your account, then sign in on the login page with your password.',
    }, { status: 201 });
  } catch (err: unknown) {
    console.error('Registration error:', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'An unexpected error occurred during registration',
    }, { status: 500 });
  }
}

