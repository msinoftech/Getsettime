import type { SupabaseClient } from '@supabase/supabase-js';
import type { ServiceProvider } from '@/src/types/booking-entities';
import {
  get_service_provider_display_phone,
  type service_provider_display_source,
} from '@/src/utils/service_provider_display';

function user_to_service_provider_shape(
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  }
): ServiceProvider {
  const meta = user.user_metadata ?? undefined;
  const phoneRaw = meta?.phone;
  const phone =
    typeof phoneRaw === 'string' && phoneRaw.trim() !== ''
      ? phoneRaw.trim()
      : undefined;
  return {
    id: user.id,
    email: user.email ?? '',
    raw_user_meta_data: {
      full_name:
        typeof meta?.full_name === 'string' ? meta.full_name : undefined,
      name: typeof meta?.name === 'string' ? meta.name : undefined,
      phone,
    },
  };
}

function user_to_owner_source(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): service_provider_display_source {
  const meta = user.user_metadata ?? undefined;
  const phoneRaw = meta?.phone;
  const phone =
    typeof phoneRaw === 'string' && phoneRaw.trim() !== ''
      ? phoneRaw.trim()
      : undefined;
  return {
    email: user.email ?? '',
    raw_user_meta_data: {
      full_name:
        typeof meta?.full_name === 'string' ? meta.full_name : undefined,
      name: typeof meta?.name === 'string' ? meta.name : undefined,
      phone,
    },
  };
}

export type get_service_provider_phone_by_booking_id_options = {
  /** When set, the booking must belong to this workspace (avoids cross-tenant id guessing). */
  workspace_id?: string;
  /**
   * Client with service role (or otherwise allowed to call `auth.admin.getUserById`).
   * Use the user-scoped `SupabaseClient` for the first argument and pass this for admin lookups.
   * If omitted, `supabase` is used for both DB and admin (typical server-only callers).
   */
  admin_supabase?: SupabaseClient;
};

/**
 * Host-side contact phone: assigned service provider first, else workspace owner.
 * Returns `null` when the booking row is missing. Returns `''` when no phone on metadata.
 */
export async function get_service_provider_phone_by_booking_id(
  supabase: SupabaseClient,
  booking_id: string,
  options?: get_service_provider_phone_by_booking_id_options
): Promise<string | null> {
  const adminClient = options?.admin_supabase ?? supabase;

  let q = supabase
    .from('bookings')
    .select('service_provider_id, workspace_id')
    .eq('id', booking_id);

  if (options?.workspace_id) {
    q = q.eq('workspace_id', options.workspace_id);
  }

  const { data: booking, error } = await q.maybeSingle();

  if (error || !booking) {
    return null;
  }

  const workspace_id = booking.workspace_id as string;
  const service_provider_id = booking.service_provider_id as string | null;

  const { data: workspaceRow } = await supabase
    .from('workspaces')
    .select('user_id')
    .eq('id', workspace_id)
    .maybeSingle();

  const owner_user_id = workspaceRow?.user_id as string | null | undefined;

  let service_provider: ServiceProvider | null = null;
  if (service_provider_id) {
    try {
      const { data: providerData } = await adminClient.auth.admin.getUserById(
        service_provider_id
      );
      const u = providerData?.user;
      if (u) {
        service_provider = user_to_service_provider_shape(u);
      }
    } catch {
      service_provider = null;
    }
    return get_service_provider_display_phone(service_provider, undefined, '');
  }

  let workspace_owner: service_provider_display_source | null = null;
  if (owner_user_id) {
    try {
      const { data: ownerData } = await adminClient.auth.admin.getUserById(
        owner_user_id
      );
      const u = ownerData?.user;
      if (u) {
        workspace_owner = user_to_owner_source(u);
      }
    } catch {
      workspace_owner = null;
    }
  }

  return get_service_provider_display_phone(null, workspace_owner, '');
}

export type admin_whatsapp_phones_for_booking_options = {
  workspace_id: string;
  admin_supabase?: SupabaseClient;
};

/** Non-empty list for WhatsApp `admin_phone`, or `[]` when unresolved / missing. */
export async function admin_whatsapp_phones_for_booking(
  supabase: SupabaseClient,
  booking_id: string,
  options: admin_whatsapp_phones_for_booking_options
): Promise<string[]> {
  const phone = await get_service_provider_phone_by_booking_id(
    supabase,
    booking_id,
    {
      workspace_id: options.workspace_id,
      admin_supabase: options.admin_supabase,
    }
  );
  return phone && phone.trim() !== '' ? [phone.trim()] : [];
}

/**
 * When a booking has no usable department name, use the workspace's only department
 * (e.g. registration default). Returns undefined if zero or multiple departments.
 */
export async function sole_workspace_department_display_name(
  supabase: SupabaseClient,
  workspace_id: string | number
): Promise<string | undefined> {
  const { data, error } = await supabase
    .from('departments')
    .select('name')
    .eq('workspace_id', workspace_id);

  if (error || !data || data.length !== 1) {
    return undefined;
  }
  const raw = data[0]?.name;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed !== '' ? trimmed : undefined;
}

export type resolved_provider_notification_contact = {
  email: string | undefined;
  provider_name: string | undefined;
};

/**
 * Host notification email: assigned service provider when present and has email;
 * otherwise workspace owner (`workspaces.user_id`). Mirrors phone resolution for WhatsApp.
 */
export async function resolve_provider_notification_contact(
  supabase: SupabaseClient,
  adminClient: SupabaseClient,
  workspace_id: string,
  service_provider_id: string | null | undefined
): Promise<resolved_provider_notification_contact> {
  let email: string | undefined;
  let provider_name: string | undefined;

  if (service_provider_id) {
    try {
      const { data: providerData, error } =
        await adminClient.auth.admin.getUserById(service_provider_id);
      const u = providerData?.user;
      if (!error && u) {
        const e = u.email?.trim();
        if (e) email = e;
        const meta = u.user_metadata;
        const n = typeof meta?.name === 'string' ? meta.name.trim() : '';
        provider_name =
          n || (e ? e.split('@')[0] : undefined) || 'Service Provider';
      }
    } catch {
      // fall through to owner
    }
  }

  if (!email) {
    const { data: workspaceRow } = await supabase
      .from('workspaces')
      .select('user_id')
      .eq('id', workspace_id)
      .maybeSingle();

    const owner_user_id = workspaceRow?.user_id as string | null | undefined;
    if (owner_user_id) {
      try {
        const { data: ownerData, error: ownerErr } =
          await adminClient.auth.admin.getUserById(owner_user_id);
        const u = ownerData?.user;
        if (!ownerErr && u) {
          const e = u.email?.trim();
          if (e) email = e;
          const meta = u.user_metadata;
          const n = typeof meta?.name === 'string' ? meta.name.trim() : '';
          provider_name =
            n || (e ? e.split('@')[0] : undefined) || provider_name || 'Workspace';
        }
      } catch {
        // noop
      }
    }
  }

  return { email, provider_name };
}
