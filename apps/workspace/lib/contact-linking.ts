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

export type InviteePatchSnapshot = {
  invitee_name: string | null;
  invitee_email: string | null;
  invitee_phone: string | null;
  contact_id: number | null;
};

/**
 * Keeps bookings.contact_id in sync when invitee fields change. If the workspace
 * already had a contact and the identifiers point to someone else, inserts a new
 * contact row linked via related_contact_id (family_member).
 */
export async function resolveContactForInviteeUpdate(
  supabase: SupabaseClient,
  workspaceId: string | number,
  existing: InviteePatchSnapshot,
  next: {
    invitee_name: string | null;
    invitee_email: string | null;
    invitee_phone: string | null;
  }
): Promise<{
  contact_id: number | null;
  metadata_patch?: Record<string, unknown>;
}> {
  const wsId = Number(workspaceId);
  const n = (s: string | null | undefined) => (s ?? '').trim();
  const before = {
    name: n(existing.invitee_name),
    email: existing.invitee_email?.trim() ? normalizeEmail(existing.invitee_email) : '',
    phone: existing.invitee_phone?.trim() ? normalizePhone(existing.invitee_phone) : '',
  };
  const after = {
    name: n(next.invitee_name),
    email: next.invitee_email?.trim() ? normalizeEmail(next.invitee_email) : '',
    phone: next.invitee_phone?.trim() ? normalizePhone(next.invitee_phone) : '',
  };

  const anyChange =
    before.name !== after.name ||
    before.email !== after.email ||
    before.phone !== after.phone;

  if (!anyChange) {
    return { contact_id: existing.contact_id };
  }

  if (existing.contact_id) {
    const { data: row, error: fetchErr } = await supabase
      .from('contacts')
      .select('id,email,phone,name')
      .eq('id', existing.contact_id)
      .eq('workspace_id', wsId)
      .maybeSingle();

    if (fetchErr) {
      console.error('resolveContactForInviteeUpdate fetch contact:', fetchErr);
    }

    if (row) {
      const rowEmail = row.email?.trim() ? normalizeEmail(String(row.email)) : '';
      const rowPhone = row.phone?.trim() ? normalizePhone(String(row.phone)) : '';
      const sameIdentity =
        rowEmail === after.email &&
        rowPhone === after.phone &&
        (after.email !== '' || after.phone !== '');

      if (sameIdentity) {
        const { error: updErr } = await supabase
          .from('contacts')
          .update({
            name: after.name || null,
            email: next.invitee_email?.trim() || null,
            phone: after.phone ? after.phone : next.invitee_phone?.trim() || null,
          })
          .eq('id', existing.contact_id);
        if (updErr) {
          console.error('resolveContactForInviteeUpdate update contact:', updErr);
        }
        return { contact_id: existing.contact_id };
      }

      const { data: created, error: insErr } = await supabase
        .from('contacts')
        .insert({
          workspace_id: wsId,
          name: after.name || null,
          email: next.invitee_email?.trim() || null,
          phone: after.phone || next.invitee_phone?.trim() || null,
          related_contact_id: existing.contact_id,
          relationship: 'family_member',
        })
        .select('id')
        .single();

      if (insErr) {
        console.error('resolveContactForInviteeUpdate insert family contact:', insErr);
        const fallback = await findOrCreateContact(
          supabase,
          workspaceId,
          after.name,
          next.invitee_email?.trim() || null,
          next.invitee_phone?.trim() || null
        );
        return { contact_id: fallback };
      }

      return {
        contact_id: (created?.id as number) ?? null,
        metadata_patch: {
          linked_from_contact_id: existing.contact_id,
          relationship: 'family_member',
        },
      };
    }
  }

  const id = await findOrCreateContact(
    supabase,
    workspaceId,
    after.name,
    next.invitee_email?.trim() || null,
    next.invitee_phone?.trim() || null
  );
  return { contact_id: id };
}
