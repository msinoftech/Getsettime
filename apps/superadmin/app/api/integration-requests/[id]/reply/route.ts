import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getSupabaseServer } from '@/lib/supabaseServer';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid request id' }, { status: 400 });
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

    const supabase = getSupabaseServer();

    const { count: existingReplyCount, error: countErr } = await supabase
      .from('integration_request_replies')
      .select('*', { count: 'exact', head: true })
      .eq('integration_request_id', id);

    if (countErr) {
      console.error('integration_request_replies count:', countErr);
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }
    if ((existingReplyCount ?? 0) > 0) {
      return NextResponse.json(
        { error: 'A reply has already been sent for this request.' },
        { status: 409 },
      );
    }

    const { data: parent, error: parentErr } = await supabase
      .from('integration_requests')
      .select('workspace_admin_email, subject, message')
      .eq('id', id)
      .maybeSingle();

    if (parentErr || !parent) {
      return NextResponse.json({ error: 'Integration request not found.' }, { status: 404 });
    }

    const to = parent.workspace_admin_email?.trim();
    if (!to) {
      return NextResponse.json({ error: 'No workspace admin email on file.' }, { status: 400 });
    }

    const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    const user = (process.env.SMTP_USER || '').trim();
    const pass = (process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '').trim();
    if (!user || !pass) {
      return NextResponse.json(
        {
          error:
            'Email is not configured. Set SMTP_USER and SMTP_PASSWORD (or SMTP_PASS) — same as the workspace app. Optional: SMTP_HOST (defaults to smtp.gmail.com). If secrets live in apps/workspace/.env.local, restart superadmin after pulling latest so next.config can merge them.',
        },
        { status: 503 },
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
    });

    const from = (process.env.SMTP_FROM || process.env.EMAIL_FROM || user).trim();
    const msgSafe = escapeHtml(messageRaw).replace(/\n/g, '<br>');
    const originalSnippet = escapeHtml(parent.message).replace(/\n/g, '<br>');

    await transporter.sendMail({
      from: `"GetSetTime (Superadmin)" <${from}>`,
      to,
      subject: subjectRaw,
      replyTo: from,
      html: `
        <p>${msgSafe}</p>
        <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;" />
        <p style="font-size:12px;"><b>Original subject:</b> ${escapeHtml(parent.subject)}</p>
        <blockquote style="font-size:12px;color:#4b5563;margin:8px 0;padding-left:12px;border-left:3px solid #c7d2fe;">
          ${originalSnippet}
        </blockquote>
      `,
    });

    const { data: inserted, error: insErr } = await supabase
      .from('integration_request_replies')
      .insert({
        integration_request_id: id,
        subject: subjectRaw,
        message: messageRaw,
      })
      .select('id, integration_request_id, subject, message, created_at')
      .single();

    if (insErr) {
      console.error('integration_request_replies insert after send:', insErr);
      const dup =
        insErr.code === '23505' ||
        (typeof insErr.message === 'string' && insErr.message.includes('duplicate key'));
      return NextResponse.json(
        {
          error: dup
            ? 'A reply has already been sent for this request.'
            : 'Email was sent but the reply could not be saved. Contact support.',
        },
        { status: dup ? 409 : 500 },
      );
    }

    return NextResponse.json({ success: true, reply: inserted });
  } catch (err: unknown) {
    console.error('POST integration-requests [id] reply:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}
