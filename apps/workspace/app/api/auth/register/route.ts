import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendConfirmationEmail } from '@/lib/email-service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || (typeof req.url === 'string' && req.url.startsWith('http') ? new URL(req.url).origin : '') || 'http://localhost:3001';
    const redirectTo = `${origin.replace(/\/$/, '')}/register?confirmed=1`;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 });
    let existingUser = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      if (existingUser.email_confirmed_at) {
        return NextResponse.json(
          { error: "This email is already registered. Please login instead." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { user: existingUser, message: "Check your email to confirm your account. If you did not receive it, try again in a few minutes." },
        { status: 201 }
      );
    }

    const { data: listData2 } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 });
    existingUser = listData2?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      if (existingUser.email_confirmed_at) {
        return NextResponse.json(
          { error: "This email is already registered. Please login instead." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { user: existingUser, message: "Check your email to confirm your account. If you did not receive it, try again in a few minutes." },
        { status: 201 }
      );
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        redirectTo,
        data: { name, role: 'workspace_admin' },
      },
    });

    if (linkError) {
      console.error('generateLink error', linkError);
      const msg = linkError.message ?? '';
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('User already registered')) {
        return NextResponse.json({ error: 'This email is already registered. Please login instead.' }, { status: 409 });
      }
      if (msg.includes('Password')) {
        return NextResponse.json({ error: 'Password does not meet requirements. Please use a stronger password.' }, { status: 400 });
      }
      if (msg.includes('Email')) {
        return NextResponse.json({ error: 'Invalid email address. Please check and try again.' }, { status: 400 });
      }
      return NextResponse.json({ error: msg || 'Failed to create user. Please try again.' }, { status: 400 });
    }

    const actionLink = linkData?.properties?.action_link;
    if (!actionLink || typeof actionLink !== 'string') {
      console.error('No action_link in generateLink response', linkData);
      return NextResponse.json({ error: 'Failed to generate confirmation link' }, { status: 500 });
    }

    try {
      await sendConfirmationEmail(email, name, actionLink);
    } catch (emailErr) {
      console.error('Failed to send confirmation email:', emailErr);
      return NextResponse.json(
        { error: 'Account created but we could not send the confirmation email. Check SMTP settings (SMTP_USER, SMTP_PASSWORD, SMTP_HOST).' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user: linkData.user ?? { id: '', email },
      message: 'Check your email to confirm your account.',
    }, { status: 201 });
  } catch (err: unknown) {
    console.error('Registration error:', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'An unexpected error occurred during registration',
    }, { status: 500 });
  }
}

