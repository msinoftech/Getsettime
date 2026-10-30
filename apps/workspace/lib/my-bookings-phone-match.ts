import { createSupabaseServerClient } from '@app/db';
import { normalizeEmbedOtpEmail } from '@/lib/embed-booking-otp-id';

export function phoneDigitsFromE164(phoneE164: string): string {
  return phoneE164.replace(/\D/g, '');
}

export function phoneMatchesStored(
  stored: string | null | undefined,
  phoneE164: string
): boolean {
  const phoneDigits = phoneDigitsFromE164(phoneE164);
  if (!stored || !phoneDigits) return false;
  if (stored === phoneE164) return true;
  const valueDigits = stored.replace(/\D/g, '');
  if (!valueDigits) return false;
  if (valueDigits === phoneDigits) return true;
  return phoneDigits.endsWith(valueDigits) || valueDigits.endsWith(phoneDigits);
}

export function emailMatchesStored(
  stored: string | null | undefined,
  customerEmail: string | null | undefined
): boolean {
  if (!stored || !customerEmail) return false;
  return stored.toLowerCase() === customerEmail.toLowerCase();
}

export type MyBookingsBookingRow = {
  id: string;
  contact_id: number | null;
  invitee_email: string | null;
  invitee_phone: string | null;
  start_at: string | null;
  created_at: string | null;
  contacts: { email: string | null; phone: string | null } | null;
};

export async function findBookingsForPhone(
  phoneE164: string | null | undefined,
  customerEmail?: string | null
): Promise<MyBookingsBookingRow[]> {
  const supabase = createSupabaseServerClient();
  const phoneE164Norm = phoneE164?.trim() || '';
  const phoneMatches = (value: string | null | undefined) =>
    phoneE164Norm ? phoneMatchesStored(value, phoneE164Norm) : false;
  const emailMatches = (value: string | null | undefined) =>
    emailMatchesStored(value, customerEmail);

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, phone, email')
    .or('phone.not.is.null,email.not.is.null');

  const contactIds = (contacts || [])
    .filter((c) => phoneMatches(c.phone) || emailMatches(c.email))
    .map((c) => c.id);

  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select(
      'id, contact_id, invitee_email, invitee_phone, start_at, created_at, contacts(email, phone)'
    )
    .order('start_at', { ascending: false });

  if (bookingsError) {
    console.error('[my-bookings-phone-match] Bookings query error:', bookingsError);
    return [];
  }

  const seenIds = new Set<string>();
  const filtered: MyBookingsBookingRow[] = [];

  for (const raw of bookings || []) {
    const row = raw as {
      id: string;
      contact_id: number | null;
      invitee_email: string | null;
      invitee_phone: string | null;
      start_at: string | null;
      created_at: string | null;
      contacts: unknown;
    };
    const contactRaw = row.contacts;
    const contact =
      contactRaw && typeof contactRaw === 'object' && !Array.isArray(contactRaw)
        ? (contactRaw as { email: string | null; phone: string | null })
        : null;
    const normalized: MyBookingsBookingRow = {
      id: String(row.id),
      contact_id: row.contact_id,
      invitee_email: row.invitee_email,
      invitee_phone: row.invitee_phone,
      start_at: row.start_at,
      created_at: row.created_at,
      contacts: contact,
    };
    const byPhone = phoneMatches(normalized.invitee_phone);
    const byEmail = emailMatches(normalized.invitee_email);
    const byContact =
      normalized.contact_id != null && contactIds.includes(normalized.contact_id);
    if (!byPhone && !byEmail && !byContact) continue;
    if (seenIds.has(String(normalized.id))) continue;
    seenIds.add(String(normalized.id));
    filtered.push(normalized);
  }

  return filtered;
}

export function resolveEmailFromMatchedBookings(
  bookings: MyBookingsBookingRow[]
): string | null {
  const withEmail = bookings
    .map((b) => {
      const contact = b.contacts;
      const raw = b.invitee_email || contact?.email || null;
      if (!raw?.trim()) return null;
      return {
        email: normalizeEmbedOtpEmail(raw),
        startAt: b.start_at ? new Date(b.start_at).getTime() : 0,
        createdAt: b.created_at ? new Date(b.created_at).getTime() : 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (withEmail.length === 0) return null;

  withEmail.sort((a, b) => {
    if (b.startAt !== a.startAt) return b.startAt - a.startAt;
    return b.createdAt - a.createdAt;
  });

  return withEmail[0].email;
}
