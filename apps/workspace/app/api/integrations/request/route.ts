import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { getAuthFromRequest } from '@/lib/auth-helpers';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function superadminNotifyEmail(): string | null {
  const v =
    (process.env.SUPERADMIN_NOTIFICATION_EMAIL || '').trim() ||
    (process.env.SEND_TO || '').trim() ||
    (process.env.SMTP_USER || '').trim();
  return v || null;
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthFromRequest(req);
    if (!auth?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (auth.workspaceId == null) {
      return NextResponse.json(
        { error: 'No workspace found. Complete onboarding before requesting integrations.' },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const subjectRaw = typeof body.subject === 'string' ? body.subject.trim() : '';
    const messageRaw = typeof body.message === 'string' ? body.message.trim() : '';

    if (!subjectRaw || !messageRaw) {
      return NextResponse.json({ error: 'Subject and message are required.' }, { status: 400 });
    }
    if (subjectRaw.length > 300) {
      return NextResponse.json({ error: 'Subject is too long.' }, { status: 400 });
    }
    if (messageRaw.length > 8000) {
      return NextResponse.json({ error: 'Message is too long.' }, { status: 400 });
    }

    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(auth.userId);
    if (userErr || !userData?.user?.email) {
      return NextResponse.json({ error: 'Could not resolve workspace admin email.' }, { status: 400 });
    }
    const workspaceAdminEmail = userData.user.email;

    const { data: workspaceRow, error: wsErr } = await supabaseAdmin
      .from('workspaces')
      .select('id, name')
      .eq('id', auth.workspaceId)
      .maybeSingle();

    if (wsErr || !workspaceRow?.name) {
      return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
    }

    const metaWid = userData.user.user_metadata?.workspace_id;
    if (metaWid == null || Number(metaWid) !== Number(workspaceRow.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('integration_requests')
      .insert({
        workspace_id: auth.workspaceId,
        workspace_name: String(workspaceRow.name),
        requested_by_user_id: auth.userId,
        workspace_admin_email: workspaceAdminEmail,
        subject: subjectRaw,
        message: messageRaw,
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('integration_requests insert:', insertErr);
      return NextResponse.json({ error: insertErr.message || 'Failed to save request' }, { status: 500 });
    }

    const to = superadminNotifyEmail();
    let emailSent = false;
    if (to && process.env.SMTP_HOST && process.env.SMTP_USER) {
      try {
        const password = (process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '').trim();
        if (password) {
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: password,
            },
          });
          const from = process.env.SMTP_FROM || process.env.SMTP_USER;
          const subSafe = escapeHtml(subjectRaw);
          const msgSafe = escapeHtml(messageRaw).replace(/\n/g, '<br>');

          await transporter.sendMail({
            from: `"GetSetTime" <${from}>`,
            to,
            replyTo: workspaceAdminEmail,
            subject: `[Integration request] ${subjectRaw}`,
            html: `
              <h2>New integration request</h2>
              <p><b>Workspace:</b> ${escapeHtml(String(workspaceRow.name))} (id: ${auth.workspaceId})</p>
              <p><b>Workspace admin:</b> ${escapeHtml(workspaceAdminEmail)}</p>
              <p><b>User id:</b> ${escapeHtml(auth.userId)}</p>
              <p><b>Subject:</b> ${subSafe}</p>
              <p><b>Message:</b></p>
              <p>${msgSafe}</p>
              <hr>
              <p><small>Request id: ${inserted?.id}; ${new Date().toISOString()}</small></p>
            `,
          });
          emailSent = true;
        }
      } catch (e) {
        console.error('Integration request email error:', e);
      }
    } else if (!to) {
      console.warn('SUPERADMIN_NOTIFICATION_EMAIL / SEND_TO / SMTP_USER not set; skipping superadmin email');
    }

    return NextResponse.json({
      success: true,
      id: inserted?.id,
      emailSent,
    });
  } catch (e: unknown) {
    console.error('POST /api/integrations/request', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}
