import crypto from 'crypto';
import { createSupabaseServerClient } from '@app/db';
import { checkRateLimit } from '@/lib/otp-service';
import {
  deliverEmbedBookingOtp,
  OTP_EXPIRY_MINUTES as EMBED_OTP_EXPIRY_MINUTES,
} from '@/lib/embed-booking-otp';
import { generateEmbedBookingOtpCode, normalizeEmbedOtpEmail } from '@/lib/embed-booking-otp-id';
import { sendWhatsAppAuthenticationOtp, sendWhatsAppMessage } from '@/lib/whatsapp';
import {
  findBookingsForPhone,
  resolveEmailFromMatchedBookings,
} from '@/lib/my-bookings-phone-match';
import { maskEmailHint, myBookingsOtpIdentifier } from '@/lib/my-bookings-otp-id';

export {
  findBookingsForPhone,
  phoneMatchesStored,
  resolveEmailFromMatchedBookings,
} from '@/lib/my-bookings-phone-match';
export {
  maskEmailHint,
  myBookingsOtpIdentifier,
  phoneDigitsForMyBookingsOtp,
} from '@/lib/my-bookings-otp-id';

const OTP_EXPIRY_MINUTES = EMBED_OTP_EXPIRY_MINUTES;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

export const MY_BOOKINGS_OTP_LOCKOUT_MESSAGE =
  'Too many incorrect verification attempts. Please try again in 30 minutes.';

export type MyBookingsOtpContext = {
  invitee_phone_e164: string;
  invitee_email_normalized: string | null;
  locked_until?: string | null;
};

function parseMyBookingsOtpContext(raw: unknown): MyBookingsOtpContext | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.invitee_phone_e164 !== 'string') return null;
  const email =
    typeof o.invitee_email_normalized === 'string'
      ? o.invitee_email_normalized
      : o.invitee_email_normalized === null
        ? null
        : null;
  return {
    invitee_phone_e164: o.invitee_phone_e164,
    invitee_email_normalized: email,
    locked_until: typeof o.locked_until === 'string' ? o.locked_until : null,
  };
}

function isLockoutActive(ctx: MyBookingsOtpContext | null, nowMs: number): boolean {
  if (!ctx?.locked_until) return false;
  return new Date(ctx.locked_until).getTime() > nowMs;
}

export async function getMyBookingsOtpLockout(
  phoneE164: string
): Promise<{ locked: boolean; message?: string }> {
  const identifier = myBookingsOtpIdentifier(phoneE164);
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('otp_verifications')
    .select('context')
    .eq('identifier', identifier)
    .maybeSingle();

  const ctx = parseMyBookingsOtpContext(data?.context);
  if (isLockoutActive(ctx, Date.now())) {
    return { locked: true, message: MY_BOOKINGS_OTP_LOCKOUT_MESSAGE };
  }
  return { locked: false };
}

export async function storeMyBookingsOtp(
  identifier: string,
  code: string,
  context: MyBookingsOtpContext
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
      console.error('[my-bookings-otp] Error storing OTP:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[my-bookings-otp] Error storing OTP:', err);
    return false;
  }
}

async function sendMyBookingsOtpWhatsApp(
  phoneE164: string,
  code: string
): Promise<boolean> {
  const usePlainText = process.env.WHATSAPP_EMBED_OTP_PLAIN_TEXT === 'true';
  if (!usePlainText) {
    try {
      await sendWhatsAppAuthenticationOtp(phoneE164, code);
      return true;
    } catch (err) {
      console.error('[my-bookings-otp] WhatsApp authentication template failed:', err);
      return false;
    }
  }
  const message = `Your booking verification code is: ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`;
  try {
    await sendWhatsAppMessage(phoneE164, message);
    return true;
  } catch (err) {
    console.error('[my-bookings-otp] WhatsApp plain-text send failed:', err);
    return false;
  }
}

export async function deliverMyBookingsOtp(params: {
  phoneE164: string;
  email: string | null;
  code: string;
}): Promise<{ email: boolean; whatsapp: boolean }> {
  const emailNorm = params.email?.trim() ? normalizeEmbedOtpEmail(params.email) : null;
  if (emailNorm) {
    return deliverEmbedBookingOtp({
      email: emailNorm,
      phoneE164: params.phoneE164,
      code: params.code,
    });
  }
  const whatsappOk = await sendMyBookingsOtpWhatsApp(params.phoneE164, params.code);
  return { email: false, whatsapp: whatsappOk };
}

export async function deleteMyBookingsOtp(identifier: string): Promise<void> {
  await createSupabaseServerClient()
    .from('otp_verifications')
    .delete()
    .eq('identifier', identifier);
}

export type SendMyBookingsOtpResult =
  | {
      ok: true;
      message: string;
      email_hint?: string;
    }
  | { ok: false; status: number; error: string };

export async function sendMyBookingsOtp(phoneE164: string): Promise<SendMyBookingsOtpResult> {
  const lockout = await getMyBookingsOtpLockout(phoneE164);
  if (lockout.locked) {
    return { ok: false, status: 429, error: lockout.message || MY_BOOKINGS_OTP_LOCKOUT_MESSAGE };
  }

  const identifier = myBookingsOtpIdentifier(phoneE164);
  const canSend = await checkRateLimit(identifier, 3, 15);
  if (!canSend) {
    return {
      ok: false,
      status: 429,
      error: 'Too many verification requests. Please try again later.',
    };
  }

  const matched = await findBookingsForPhone(phoneE164);
  if (matched.length === 0) {
    return {
      ok: false,
      status: 404,
      error: 'No bookings found for this phone number',
    };
  }

  const resolvedEmail = resolveEmailFromMatchedBookings(matched);
  const otp = generateEmbedBookingOtpCode();
  const context: MyBookingsOtpContext = {
    invitee_phone_e164: phoneE164,
    invitee_email_normalized: resolvedEmail,
  };

  const stored = await storeMyBookingsOtp(identifier, otp, context);
  if (!stored) {
    return {
      ok: false,
      status: 500,
      error: 'Failed to send verification code. Please try again.',
    };
  }

  const delivery = await deliverMyBookingsOtp({
    phoneE164,
    email: resolvedEmail,
    code: otp,
  });

  if (!delivery.email && !delivery.whatsapp) {
    await deleteMyBookingsOtp(identifier);
    return {
      ok: false,
      status: 500,
      error: 'Failed to send verification code. Please try again.',
    };
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] My bookings OTP generated for ${identifier} (not exposed to client)`);
  }

  const message =
    delivery.email && delivery.whatsapp
      ? 'Verification code sent to your WhatsApp and email'
      : delivery.whatsapp
        ? 'Verification code sent to your WhatsApp'
        : 'Verification code sent to your email';

  return {
    ok: true,
    message,
    ...(resolvedEmail && delivery.email
      ? { email_hint: maskEmailHint(resolvedEmail) }
      : {}),
  };
}

export async function verifyMyBookingsOtpAndCreateSession(
  phoneE164: string,
  code: string
): Promise<
  | { ok: true; token: string }
  | { ok: false; error: string; lockout?: boolean }
> {
  const identifier = myBookingsOtpIdentifier(phoneE164);
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

  const ctx = parseMyBookingsOtpContext(data.context);
  if (isLockoutActive(ctx, nowMs)) {
    return { ok: false, error: MY_BOOKINGS_OTP_LOCKOUT_MESSAGE, lockout: true };
  }

  if (new Date(data.expires_at) < new Date(now)) {
    await supabase.from('otp_verifications').delete().eq('identifier', identifier);
    return { ok: false, error: 'Invalid or expired verification code' };
  }

  if (!ctx || ctx.invitee_phone_e164 !== phoneE164) {
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
      return { ok: false, error: MY_BOOKINGS_OTP_LOCKOUT_MESSAGE, lockout: true };
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

  await supabase
    .from('phone_verification_sessions')
    .delete()
    .eq('phone_e164', phoneE164);

  const { data: session, error: sessionError } = await supabase
    .from('phone_verification_sessions')
    .insert({ phone_e164: phoneE164 })
    .select('token')
    .single();

  if (sessionError || !session?.token) {
    console.error('[my-bookings-otp] Session creation failed:', sessionError);
    return { ok: false, error: 'Failed to create session. Please try again.' };
  }

  return { ok: true, token: session.token };
}

export { checkRateLimit };
