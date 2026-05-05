/**
 * Workspace Settings → Notifications keys persisted under configurations.settings.notifications.
 * Legacy workspaces had only `whatsapp`; user-channel reads fall back to that when `whatsapp-user` is absent.
 */
export type workspace_notifications_settings = {
  whatsapp?: boolean;
  'whatsapp-user'?: boolean;
};

export function is_whatsapp_admin_enabled(
  notifications: workspace_notifications_settings | undefined | null
): boolean {
  return notifications?.whatsapp === true;
}

export function is_whatsapp_user_enabled(
  notifications: workspace_notifications_settings | undefined | null
): boolean {
  const raw = notifications?.['whatsapp-user'];
  if (raw !== undefined) {
    return raw === true;
  }
  return notifications?.whatsapp === true;
}
