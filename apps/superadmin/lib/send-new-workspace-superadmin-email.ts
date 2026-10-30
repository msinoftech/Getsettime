import nodemailer from 'nodemailer';

export type new_workspace_registration_source = 'self-serve' | 'superadmin dashboard';

export type send_new_workspace_superadmin_email_params = {
  workspaceId: number | string;
  workspaceName: string;
  workspaceSlug: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  source: new_workspace_registration_source;
};

function resolveSuperadminNotifyEmail(): string | null {
  const v =
    (process.env.SUPERADMIN_NOTIFICATION_EMAIL || '').trim() ||
    (process.env.SEND_TO || '').trim() ||
    (process.env.SMTP_USER || '').trim();
  return v || null;
}

function escapeHtmlForEmail(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getSuperadminWorkspacesUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SUPERADMIN_API_URL || '').trim();
  if (raw) {
    return `${raw.replace(/\/$/, '')}/workspaces`;
  }
  return '/workspaces';
}

function createSmtpTransporter(): nodemailer.Transporter | null {
  const host = (process.env.SMTP_HOST || '').trim();
  const user = (process.env.SMTP_USER || '').trim();
  const password = (process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '').trim();
  if (!host || !user || !password) {
    return null;
  }
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass: password },
  });
}

/** Non-blocking alert to platform Superadmin when a workspace row is created. */
export async function sendNewWorkspaceSuperadminEmail(
  params: send_new_workspace_superadmin_email_params
): Promise<void> {
  const to = resolveSuperadminNotifyEmail();
  if (!to) {
    console.warn(
      'SUPERADMIN_NOTIFICATION_EMAIL / SEND_TO / SMTP_USER not set; skipping new-workspace superadmin email'
    );
    return;
  }

  const transporter = createSmtpTransporter();
  if (!transporter) {
    console.warn('SMTP not configured; skipping new-workspace superadmin email');
    return;
  }

  const {
    workspaceId,
    workspaceName,
    workspaceSlug,
    ownerName,
    ownerEmail,
    source,
  } = params;

  const nameSafe = escapeHtmlForEmail(workspaceName);
  const slugSafe = escapeHtmlForEmail(workspaceSlug);
  const ownerNameSafe = ownerName?.trim()
    ? escapeHtmlForEmail(ownerName.trim())
    : '—';
  const ownerEmailSafe = ownerEmail?.trim()
    ? escapeHtmlForEmail(ownerEmail.trim())
    : '—';
  const sourceLabel =
    source === 'self-serve' ? 'Self-serve signup' : 'Superadmin dashboard';
  const workspacesUrl = getSuperadminWorkspacesUrl();

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from: `"GetSetTime" <${from}>`,
    to,
    subject: `New workspace registered: ${workspaceName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background-color: #4F46E5; color: #fff !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px; }
    .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New workspace registered</h1>
    </div>
    <div class="content">
      <p>A new workspace was created on GetSetTime.</p>
      <p><strong>Workspace:</strong> ${nameSafe}</p>
      <p><strong>Slug:</strong> ${slugSafe}</p>
      <p><strong>Workspace ID:</strong> ${workspaceId}</p>
      <p><strong>Owner name:</strong> ${ownerNameSafe}</p>
      <p><strong>Owner email:</strong> ${ownerEmailSafe}</p>
      <p><strong>Source:</strong> ${sourceLabel}</p>
      <p><strong>Plan:</strong> Free</p>
      <p><a class="button" href="${escapeHtmlForEmail(workspacesUrl)}">View workspaces</a></p>
    </div>
    <div class="footer">
      <p>Registered: ${new Date().toISOString()}</p>
    </div>
  </div>
</body>
</html>
    `,
  });
}
