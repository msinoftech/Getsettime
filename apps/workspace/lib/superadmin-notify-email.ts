/** Platform ops inbox: integration requests, new workspace alerts, etc. */
export function resolveSuperadminNotifyEmail(): string | null {
  const v =
    (process.env.SUPERADMIN_NOTIFICATION_EMAIL || '').trim() ||
    (process.env.SEND_TO || '').trim() ||
    (process.env.SMTP_USER || '').trim();
  return v || null;
}

export function escapeHtmlForEmail(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
