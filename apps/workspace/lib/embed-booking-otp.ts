import crypto from 'crypto';
import { createSupabaseServerClient } from '@app/db';
import { checkRateLimit } from '@/lib/otp-service';
import { sendBookingVerificationOtpEmail } from '@/lib/email-service';
import { sendWhatsAppAuthenticationOtp, sendWhatsAppMessage } from '@/lib/whatsapp';
import {
  embedOtpIdentifier,
  generateEmbedBookingOtpCode,
  normalizeEmbedOtpEmail,
} from '@/lib/embed-booking-otp-id';

export {
  embedOtpIdentifier,
  generateEmbedBookingOtpCode,
  normalizeEmbedOtpEmail,
  phoneDigitsForEmbedOtp,
} from '@/lib/embed-booking-otp-id';

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;
const VERIFICATION_TOKEN_EXPIRY_MINUTES = 15;

export const EMBED_OTP_LOCKOUT_MESSAGE =
  'Too many incorrect verification attempts. Please try again in 30 minutes.';

export type EmbedOtpContext = {
  invitee_email_normalized: string;
  invitee_phone_e164: string;
  locked_until?: string | null;
};

function parseEmbedOtpContext(raw: unknown): EmbedOtpContext | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.invitee_email_normalized !== 'string' ||
    typeof o.invitee_phone_e164 !== 'string'
  ) {
    return null;
  }
  return {
    invitee_email_normalized: o.invitee_email_normalized,
    invitee_phone_e164: o.invitee_phone_e164,
    locked_until:
      typeof o.locked_until === 'string' ? o.locked_until : null,
  };
}

function isLockoutActive(ctx: EmbedOtpContext | null, nowMs: number): boolean {
  if (!ctx?.locked_until) return false;
  return new Date(ctx.locked_until).getTime() > nowMs;
}

export async function getEmbedOtpLockout(
  workspaceId: string | number,
  phoneE164: string
): Promise<{ locked: boolean; message?: string }> {
  const identifier = embedOtpIdentifier(workspaceId, phoneE164);
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('otp_verifications')
    .select('context')
    .eq('identifier', identifier)
    .maybeSingle();

  const ctx = parseEmbedOtpContext(data?.context);
  if (isLockoutActive(ctx, Date.now())) {
    return { locked: true, message: EMBED_OTP_LOCKOUT_MESSAGE };
  }
  return { locked: false };
}

export async function assertWorkspaceExists(workspaceId: string | number): Promise<boolean> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .maybeSingle();
  return !error && Boolean(data?.id);
}

export async function storeEmbedBookingOtp(
  identifier: string,
  code: string,
  context: EmbedOtpContext
): Promise<boolean> {
  try {
    const supabase = createSupabaseServerClient();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    await supabase.from('otp_verifications').delete().eq('identifier', identifier);

    const { error } = await supabase.from('otp_verifications').insert({
      identifier,
      code,
      expires_at: expiresAt.toISOString(),
      attempts: 0,
      type: 'phone',
      context,
    });

    if (error) {
      console.error('Error storing embed booking OTP:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error storing embed booking OTP:', err);
    return false;
  }
}

async function sendEmbedOtpWhatsApp(phoneE164: string, code: string): Promise<boolean> {
  const usePlainText = process.env.WHATSAPP_EMBED_OTP_PLAIN_TEXT === 'true';
  if (!usePlainText) {
    try {
      await sendWhatsAppAuthenticationOtp(phoneE164, code);
      return true;
    } catch (err) {
      console.error('Embed OTP WhatsApp authentication template failed:', err);
      return false;
    }
  }
  const message = `Your booking verification code is: ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`;
  try {
    await sendWhatsAppMessage(phoneE164, message);
    return true;
  } catch (err) {
    console.error('Embed OTP WhatsApp plain-text send failed:', err);
    return false;
  }
}

async function sendEmbedOtpEmail(email: string, code: string): Promise<boolean> {
  return sendBookingVerificationOtpEmail(email, code, OTP_EXPIRY_MINUTES);
}

export async function deliverEmbedBookingOtp(params: {
  email: string;
  phoneE164: string;
  code: string;
}): Promise<{ email: boolean; whatsapp: boolean }> {
  const [emailOk, whatsappOk] = await Promise.all([
    sendEmbedOtpEmail(params.email, params.code),
    sendEmbedOtpWhatsApp(params.phoneE164, params.code),
  ]);
  return { email: emailOk, whatsapp: whatsappOk };
}

export async function verifyEmbedBookingOtpAndIssueToken(
  workspaceId: string | number,
  phoneE164: string,
  email: string,
  code: string
): Promise<
  | { ok: true; verification_token: string }
  | { ok: false; error: string; lockout?: boolean }
> {
  const identifier = embedOtpIdentifier(workspaceId, phoneE164);
  const emailNorm = normalizeEmbedOtpEmail(email);
  const supabase = createSupabaseServerClient();
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();

  const { data, error } = await supabase
    .from('otp_verifications')
    .select('*')
    .eq('identifier', identifier)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: 'Invalid or expired verification code' };
  }

  const ctx = parseEmbedOtpContext(data.context);
  if (isLockoutActive(ctx, nowMs)) {
    return { ok: false, error: EMBED_OTP_LOCKOUT_MESSAGE, lockout: true };
  }

  if (new Date(data.expires_at) < new Date(now)) {
    await supabase.from('otp_verifications').delete().eq('identifier', identifier);
    return { ok: false, error: 'Invalid or expired verification code' };
  }

  if (
    !ctx ||
    ctx.invitee_email_normalized !== emailNorm ||
    ctx.invitee_phone_e164 !== phoneE164
  ) {
    return { ok: false, error: 'Invalid or expired verification code' };
  }

  const storedCode = typeof data.code === 'string' ? data.code : '';
  if (!storedCode) {
    return { ok: false, error: 'Invalid or expired verification code' };
  }

  const submitted = String(code).trim();
  let codeOk = false;
  if (storedCode.length === submitted.length && submitted.length === 6) {
    codeOk = crypto.timingSafeEqual(Buffer.from(storedCode), Buffer.from(submitted));
  }

  if (!codeOk) {
    const newAttempts = (data.attempts ?? 0) + 1;
    if (newAttempts >= MAX_ATTEMPTS) {
      const lockedUntil = new Date(nowMs + LOCKOUT_MINUTES * 60_000);
      await supabase
        .from('otp_verifications')
        .update({
          attempts: newAttempts,
          code: '',
          expires_at: lockedUntil.toISOString(),
          context: {
            ...ctx,
            locked_until: lockedUntil.toISOString(),
          },
        })
        .eq('identifier', identifier);
      return { ok: false, error: EMBED_OTP_LOCKOUT_MESSAGE, lockout: true };
    }

    await supabase
      .from('otp_verifications')
      .update({ attempts: newAttempts })
      .eq('identifier', identifier);

    const remaining = MAX_ATTEMPTS - newAttempts;
    if (remaining <= 2) {
      return {
        ok: false,
        error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before a 30-minute lockout.`,
      };
    }
    return { ok: false, error: 'Invalid or expired verification code' };
  }

  await supabase.from('otp_verifications').delete().eq('identifier', identifier);

  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + VERIFICATION_TOKEN_EXPIRY_MINUTES);

  const { error: insertError } = await supabase.from('embed_booking_verification_tokens').insert({
    token,
    workspace_id: Number(workspaceId),
    invitee_phone_e164: phoneE164,
    invitee_email_normalized: emailNorm,
    expires_at: expiresAt.toISOString(),
  });

  if (insertError) {
    console.error('Failed to create verification token:', insertError);
    return { ok: false, error: 'Verification failed. Please try again.' };
  }

  return { ok: true, verification_token: token };
}

export async function consumeEmbedBookingVerificationToken(
  verificationToken: string,
  workspaceId: string | number,
  inviteePhoneE164: string | null,
  inviteeEmail: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!verificationToken?.trim()) {
    return { ok: false, error: 'Booking verification is required' };
  }
  if (!inviteePhoneE164 || !inviteeEmail?.trim()) {
    return { ok: false, error: 'Phone and email are required for booking verification' };
  }

  const emailNorm = normalizeEmbedOtpEmail(inviteeEmail);
  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('embed_booking_verification_tokens')
    .select('*')
    .eq('token', verificationToken.trim())
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: 'Invalid or expired booking verification' };
  }

  if (data.used_at) {
    return { ok: false, error: 'Invalid or expired booking verification' };
  }

  if (new Date(data.expires_at) < new Date(now)) {
    return { ok: false, error: 'Invalid or expired booking verification' };
  }

  if (
    Number(data.workspace_id) !== Number(workspaceId) ||
    data.invitee_phone_e164 !== inviteePhoneE164 ||
    data.invitee_email_normalized !== emailNorm
  ) {
    return { ok: false, error: 'Invalid or expired booking verification' };
  }

  const { data: consumed, error: consumeError } = await supabase
    .from('embed_booking_verification_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', verificationToken.trim())
    .is('used_at', null)
    .select('token')
    .maybeSingle();

  if (consumeError || !consumed) {
    return { ok: false, error: 'Invalid or expired booking verification' };
  }

  return { ok: true };
}

export { checkRateLimit, OTP_EXPIRY_MINUTES };
