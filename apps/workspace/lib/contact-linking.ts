import type { SupabaseClient } from '@supabase/supabase-js';

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Find existing contact by email or phone in workspace, or create new one.
 * Returns contact_id for use in bookings.contact_id.
 * Returns null if no identifier (email/phone) - cannot create/link.
 */
export async function findOrCreateContact(
  supabase: SupabaseClient,
  workspaceId: string | number,
  name: string,
  email: string | null,
  phone: string | null
): Promise<number | null> {
  const wsId = Number(workspaceId);
  const emailNorm = email?.trim() ? normalizeEmail(email.trim()) : null;
  const phoneNorm = phone?.trim() ? normalizePhone(phone.trim()) : null;
  const phoneRaw = phone?.trim() || null;

  if (!emailNorm && !phoneNorm) {
    return null;
  }

  // Find existing contact by email
  if (emailNorm) {
    const { data: byEmail } = await supabase
      .from('contacts')
      .select('id')
      .eq('workspace_id', wsId)
      .ilike('email', emailNorm)
      .limit(1)
      .maybeSingle();
    if (byEmail?.id) return byEmail.id as number;
  }

  // Find existing contact by phone (try normalized and raw)
  if (phoneNorm) {
    const orParts = [`phone.eq.${phoneNorm}`];
    if (phoneRaw && phoneRaw !== phoneNorm) orParts.push(`phone.eq.${phoneRaw}`);
    const { data: byPhone } = await supabase
      .from('contacts')
      .select('id')
      .eq('workspace_id', wsId)
      .or(orParts.join(','))
      .limit(1)
      .maybeSingle();
    if (byPhone?.id) return byPhone.id as number;
  }

  // Create new contact (store phone normalized for future matching)
  const { data: created, error } = await supabase
    .from('contacts')
    .insert({
      workspace_id: wsId,
      name: name?.trim() || null,
      email: email?.trim() || null,
      phone: phoneNorm || phoneRaw || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating contact:', error);
    return null;
  }

  return created?.id as number;
}
