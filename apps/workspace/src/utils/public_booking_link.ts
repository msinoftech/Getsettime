/** Origin for workspace public booking pages (`/{workspaceSlug}`). */
export function get_public_booking_origin(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      const stripped = raw.replace(/^https?:\/\//, '').split('/')[0];
      if (stripped) return `https://${stripped}`;
    }
  }
  return 'https://getsettime.com';
}

/** Full public booking URL from Settings → My Link (workspace slug). */
export function build_workspace_public_booking_url(
  slug: string | null | undefined
): string | null {
  const trimmed = typeof slug === 'string' ? slug.trim() : '';
  if (!trimmed) return null;
  return `${get_public_booking_origin()}/${trimmed}`;
}

export function build_public_booking_qr_url(booking_url: string, size = 220): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    booking_url
  )}`;
}

export type public_booking_share_result = 'shared' | 'fallback' | 'cancelled';

/** Native share when available; otherwise caller should open the share fallback modal. */
export async function share_public_booking_with_customer(
  booking_url: string,
  workspace_title: string
): Promise<public_booking_share_result> {
  const shareText = `You can book your appointment with ${workspace_title} using this link:`;
  const shareData: ShareData = {
    title: 'Book an appointment',
    text: shareText,
    url: booking_url,
  };

  try {
    const can_use_native_share =
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      (typeof navigator.canShare !== 'function' || navigator.canShare(shareData)) &&
      window.isSecureContext;

    if (can_use_native_share) {
      await navigator.share(shareData);
      return 'shared';
    }
    return 'fallback';
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    return 'fallback';
  }
}

export function open_public_booking_whatsapp(
  booking_url: string,
  workspace_title: string
): void {
  window.open(
    `https://wa.me/?text=${encodeURIComponent(
      `Book your appointment with ${workspace_title}: ${booking_url}`
    )}`,
    '_blank',
    'noopener,noreferrer'
  );
}

export function open_public_booking_email(
  booking_url: string,
  workspace_title: string
): void {
  window.location.href = `mailto:?subject=${encodeURIComponent(
    `Book an appointment — ${workspace_title}`
  )}&body=${encodeURIComponent(
    `Hi,\n\nYou can book your appointment using this link:\n${booking_url}\n\nThank you.`
  )}`;
}

export async function download_public_booking_qr(booking_url: string): Promise<boolean> {
  const qr_url = build_public_booking_qr_url(booking_url);
  try {
    const response = await fetch(qr_url);
    const blob = await response.blob();
    const object_url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = object_url;
    link.download = 'public-booking-qr.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(object_url);
    return true;
  } catch {
    return false;
  }
}

export async function copy_text_to_clipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback below */
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
