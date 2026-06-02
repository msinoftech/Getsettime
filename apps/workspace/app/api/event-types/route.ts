import { NextRequest, NextResponse } from 'next/server';
import { MANAGE_ROLES, ROLE_SERVICE_PROVIDER } from '@/src/constants/roles';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { appendActivityLog } from '@/lib/activity-log';
import { userActsAsServiceProviderFromMetadata } from '@/lib/service_provider_role';
import { user_belongs_to_workspace } from '@/lib/team_members_workspace';

/**
 * Creates an authenticated Supabase client using the anon key (respects RLS)
 * Sets the auth session from the request's bearer token
 */
function createAuthenticatedClient(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  // Create client with anon key - respects RLS policies
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  return { supabase, token };
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function userCanAssignEventTypeOwner(user: User): boolean {
  const role = user.user_metadata?.role;
  return typeof role === 'string' && MANAGE_ROLES.includes(role);
}

async function validateServiceProviderOwnerInWorkspace(
  adminClient: SupabaseClient,
  workspaceId: number,
  ownerId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: targetResult, error } = await adminClient.auth.admin.getUserById(ownerId);
  if (error || !targetResult.user) {
    return { ok: false, message: 'Invalid service provider.' };
  }

  const target = targetResult.user;
  if (!user_belongs_to_workspace(target, workspaceId)) {
    return { ok: false, message: 'Service provider is not in this workspace.' };
  }

  const meta = target.user_metadata as Record<string, unknown> | undefined;
  if (meta?.deactivated === true) {
    return { ok: false, message: 'Selected service provider is inactive.' };
  }

  const additionalRolesRaw = meta?.additional_roles;
  const additional_roles = Array.isArray(additionalRolesRaw)
    ? additionalRolesRaw.filter((role): role is string => typeof role === 'string')
    : [];

  if (
    !userActsAsServiceProviderFromMetadata({
      role: typeof meta?.role === 'string' ? meta.role : null,
      is_workspace_owner: meta?.is_workspace_owner === true,
      additional_roles,
    })
  ) {
    return { ok: false, message: 'Invalid service provider.' };
  }

  return { ok: true };
}

async function resolveEventTypeOwnerId(
  user: User,
  workspaceId: number,
  bodyOwnerId: unknown
): Promise<{ ok: true; ownerId: string } | { ok: false; message: string }> {
  if (!userCanAssignEventTypeOwner(user)) {
    return { ok: true, ownerId: user.id };
  }

  const requested =
    typeof bodyOwnerId === 'string' && bodyOwnerId.trim() !== ''
      ? bodyOwnerId.trim()
      : null;

  if (!requested) {
    return { ok: true, ownerId: user.id };
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return { ok: false, message: 'Server configuration error' };
  }

  const validation = await validateServiceProviderOwnerInWorkspace(
    adminClient,
    workspaceId,
    requested
  );
  if (!validation.ok) {
    return validation;
  }

  return { ok: true, ownerId: requested };
}

function parse_duration_minutes(value: unknown): { ok: true; value: number } | { ok: false; message: string } {
  if (value === null || value === undefined) {
    return { ok: false, message: 'Duration (minutes) is required.' };
  }
  const raw = typeof value === 'number' && Number.isFinite(value) ? String(Math.trunc(value)) : String(value).trim();
  if (!raw) {
    return { ok: false, message: 'Duration (minutes) is required.' };
  }
  if (!/^\d+$/.test(raw)) {
    return { ok: false, message: 'Duration must be a whole number of minutes (1 or more).' };
  }
  const n = parseInt(raw, 10);
  if (n < 1) {
    return { ok: false, message: 'Duration must be at least 1 minute.' };
  }
  return { ok: true, value: n };
}

const EVENT_TYPE_LOCATION_TYPES = new Set(['in_person', 'phone', 'video', 'custom']);

function parse_optional_buffer_minutes(
  value: unknown
): { ok: true; value: number | null } | { ok: false; message: string } {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }
  if (typeof value === 'string' && value.trim() === '') {
    return { ok: true, value: null };
  }
  const raw =
    typeof value === 'number' && Number.isFinite(value) ? String(Math.trunc(value)) : String(value).trim();
  if (!raw) {
    return { ok: true, value: null };
  }
  if (!/^\d+$/.test(raw)) {
    return { ok: false, message: 'Buffer before/after must be whole minutes (0 or more).' };
  }
  const n = parseInt(raw, 10);
  if (n < 0) {
    return { ok: false, message: 'Buffer before/after cannot be negative.' };
  }
  return { ok: true, value: n };
}

function parse_location_type(
  value: unknown
): { ok: true; value: string | null } | { ok: false; message: string } {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }

  let parts: string[];
  if (Array.isArray(value)) {
    parts = value.map((v) => String(v).trim()).filter(Boolean);
  } else {
    const s = String(value).trim();
    if (!s) {
      return { ok: true, value: null };
    }
    parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  }

  if (parts.length === 0) {
    return { ok: true, value: null };
  }

  const unique: string[] = [];
  for (const part of parts) {
    if (!EVENT_TYPE_LOCATION_TYPES.has(part)) {
      return { ok: false, message: 'Invalid location type.' };
    }
    if (!unique.includes(part)) {
      unique.push(part);
    }
  }

  const order = ['in_person', 'phone', 'video', 'custom'] as const;
  const sorted = order.filter((t) => unique.includes(t));
  return { ok: true, value: sorted.join(',') };
}

function parse_is_public(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const t = value.trim().toLowerCase();
    return t === 'true' || t === '1';
  }
  return false;
}

function slugify_event_title(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * Picks slug, then slug-1, slug-2, … until unused in the workspace (excluding one row on update).
 */
async function resolve_unique_event_type_slug(
  supabase: SupabaseClient,
  workspaceId: number,
  base_slug: string,
  exclude_event_type_id?: number
): Promise<{ slug: string; error: string | null }> {
  const { data: rows, error } = await supabase
    .from('event_types')
    .select('id, slug')
    .eq('workspace_id', workspaceId);

  if (error) {
    return { slug: base_slug, error: error.message };
  }

  const taken = new Set<string>();
  for (const row of rows ?? []) {
    if (
      exclude_event_type_id != null &&
      Number(row.id) === Number(exclude_event_type_id)
    ) {
      continue;
    }
    const s = row.slug;
    if (typeof s === 'string' && s.length > 0) taken.add(s);
  }

  let candidate = base_slug;
  let n = 0;
  while (taken.has(candidate)) {
    n += 1;
    candidate = `${base_slug}-${n}`;
  }

  return { slug: candidate, error: null };
}

export async function GET(req: NextRequest) {
  try {
    const result = createAuthenticatedClient(req);
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, token } = result;

    // Verify auth - will fail if token is invalid
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // RLS automatically filters by workspace_id and owner_id from JWT
    const { data, error } = await supabase
      .from('event_types')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching event types:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const role = user.user_metadata?.role as string | undefined;
    const serviceProviderIdParam =
      new URL(req.url).searchParams.get('service_provider_id')?.trim() || '';

    let event_types = data || [];
    if (serviceProviderIdParam) {
      event_types = event_types.filter(
        (row: { owner_id?: string | null }) =>
          row.owner_id === serviceProviderIdParam
      );
    } else if (role === ROLE_SERVICE_PROVIDER) {
      event_types = event_types.filter(
        (row: { owner_id?: string | null }) => row.owner_id === user.id
      );
    }
    const event_type_ids = event_types
      .map((row: { id: number | string | null }) => row.id)
      .filter((id: number | string | null): id is number | string => id !== null && id !== undefined);

    const bookings_count_by_event_type = new Map<string, number>();
    if (event_type_ids.length > 0) {
      const { data: booking_rows, error: bookings_error } = await supabase
        .from('bookings')
        .select('event_type_id')
        .in('event_type_id', event_type_ids);

      if (bookings_error) {
        console.error('Error fetching booking counts:', bookings_error);
      } else {
        for (const row of booking_rows ?? []) {
          const key = row.event_type_id == null ? '' : String(row.event_type_id);
          if (!key) continue;
          bookings_count_by_event_type.set(
            key,
            (bookings_count_by_event_type.get(key) || 0) + 1
          );
        }
      }
    }

    const data_with_counts = event_types.map((row: Record<string, unknown>) => ({
      ...row,
      bookings_count:
        bookings_count_by_event_type.get(String(row.id)) ?? 0,
    }));

    const total_bookings_count = data_with_counts.reduce(
      (sum: number, row: { bookings_count?: number }) => sum + (row.bookings_count ?? 0),
      0
    );

    return NextResponse.json({
      data: data_with_counts,
      total_bookings_count,
    });
  } catch (err: any) {
    console.error('Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = createAuthenticatedClient(req);
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, token } = result;

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, duration_minutes, buffer_before, buffer_after, location_type, is_public, owner_id } =
      body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const durationResult = parse_duration_minutes(duration_minutes);
    if (!durationResult.ok) {
      return NextResponse.json({ error: durationResult.message }, { status: 400 });
    }

    const bufferBefore = parse_optional_buffer_minutes(buffer_before);
    if (!bufferBefore.ok) {
      return NextResponse.json({ error: bufferBefore.message }, { status: 400 });
    }
    const bufferAfter = parse_optional_buffer_minutes(buffer_after);
    if (!bufferAfter.ok) {
      return NextResponse.json({ error: bufferAfter.message }, { status: 400 });
    }
    const locationParsed = parse_location_type(location_type);
    if (!locationParsed.ok) {
      return NextResponse.json({ error: locationParsed.message }, { status: 400 });
    }
    const publicFlag = parse_is_public(is_public);

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const wid = typeof workspaceId === 'number' ? workspaceId : Number(workspaceId);
    if (!Number.isFinite(wid)) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const base_slug = slugify_event_title(title);
    const { slug: unique_slug, error: slugError } = await resolve_unique_event_type_slug(supabase, wid, base_slug);
    if (slugError) {
      console.error('resolve_unique_event_type_slug:', slugError);
      return NextResponse.json({ error: slugError }, { status: 500 });
    }

    const ownerResult = await resolveEventTypeOwnerId(user, wid, owner_id);
    if (!ownerResult.ok) {
      return NextResponse.json({ error: ownerResult.message }, { status: 400 });
    }

    // RLS validates workspace_id matches JWT; we provide it for INSERT WITH CHECK policy
    const { data, error } = await supabase
      .from('event_types')
      .insert({
        workspace_id: wid,
        owner_id: ownerResult.ownerId,
        title: title.trim(),
        slug: unique_slug,
        duration_minutes: durationResult.value,
        buffer_before: bufferBefore.value,
        buffer_after: bufferAfter.value,
        location_type: locationParsed.value,
        location_value: null,
        is_public: publicFlag,
        settings: null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating event type:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await appendActivityLog(wid, {
      type: 'event_type',
      action: 'created',
      entity_id: data?.id,
      actor_user_id: user.id,
      title: 'Event type created',
      description: data?.title || title.trim(),
      after_data: {
        title: data?.title || title.trim(),
        duration_minutes: data?.duration_minutes,
        is_public: data?.is_public,
      },
    });

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const result = createAuthenticatedClient(req);
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, token } = result;

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, duration_minutes, buffer_before, buffer_after, location_type, is_public, owner_id } =
      body;

    if (!id) {
      return NextResponse.json({ error: 'Event type ID is required' }, { status: 400 });
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const durationPatch = parse_duration_minutes(duration_minutes);
    if (!durationPatch.ok) {
      return NextResponse.json({ error: durationPatch.message }, { status: 400 });
    }

    const bufferBeforePatch = parse_optional_buffer_minutes(buffer_before);
    if (!bufferBeforePatch.ok) {
      return NextResponse.json({ error: bufferBeforePatch.message }, { status: 400 });
    }
    const bufferAfterPatch = parse_optional_buffer_minutes(buffer_after);
    if (!bufferAfterPatch.ok) {
      return NextResponse.json({ error: bufferAfterPatch.message }, { status: 400 });
    }
    const locationPatch = parse_location_type(location_type);
    if (!locationPatch.ok) {
      return NextResponse.json({ error: locationPatch.message }, { status: 400 });
    }
    const publicPatch = parse_is_public(is_public);

    const workspaceId = user.user_metadata?.workspace_id;
    const wid = typeof workspaceId === 'number' ? workspaceId : Number(workspaceId);
    if (!Number.isFinite(wid)) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const base_slug = slugify_event_title(title);
    const idNum = typeof id === 'number' ? id : Number(id);
    const { slug: unique_slug, error: slugError } = await resolve_unique_event_type_slug(
      supabase,
      wid,
      base_slug,
      Number.isFinite(idNum) ? idNum : undefined
    );
    if (slugError) {
      console.error('resolve_unique_event_type_slug (patch):', slugError);
      return NextResponse.json({ error: slugError }, { status: 500 });
    }

    const ownerResult = await resolveEventTypeOwnerId(user, wid, owner_id);
    if (!ownerResult.ok) {
      return NextResponse.json({ error: ownerResult.message }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {
      title: title.trim(),
      slug: unique_slug,
      duration_minutes: durationPatch.value,
      buffer_before: bufferBeforePatch.value,
      buffer_after: bufferAfterPatch.value,
      location_type: locationPatch.value,
      is_public: publicPatch,
    };

    if (userCanAssignEventTypeOwner(user)) {
      updatePayload.owner_id = ownerResult.ownerId;
    }

    const { data: beforeEventType } = await supabase
      .from('event_types')
      .select('id,title,duration_minutes,buffer_before,buffer_after,location_type,is_public,owner_id')
      .eq('id', id)
      .single();

    // RLS automatically filters by workspace_id and owner_id from JWT
    const { data, error } = await supabase
      .from('event_types')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating event type:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Event type not found or access denied' }, { status: 404 });
    }

    await appendActivityLog(wid, {
      type: 'event_type',
      action: 'updated',
      entity_id: data?.id,
      actor_user_id: user.id,
      title: 'Event type updated',
      description: data?.title || title.trim(),
      before_data: {
        title: beforeEventType?.title,
        duration_minutes: beforeEventType?.duration_minutes,
        buffer_before: beforeEventType?.buffer_before,
        buffer_after: beforeEventType?.buffer_after,
        location_type: beforeEventType?.location_type,
        is_public: beforeEventType?.is_public,
        owner_id: beforeEventType?.owner_id,
      },
      after_data: {
        title: data?.title,
        duration_minutes: data?.duration_minutes,
        buffer_before: data?.buffer_before,
        buffer_after: data?.buffer_after,
        location_type: data?.location_type,
        is_public: data?.is_public,
        owner_id: data?.owner_id,
      },
    });

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const result = createAuthenticatedClient(req);
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, token } = result;

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Event type ID is required' }, { status: 400 });
    }

    const { data: beforeEventType } = await supabase
      .from('event_types')
      .select('id,title')
      .eq('id', id)
      .single();

    // RLS automatically filters by workspace_id and owner_id from JWT
    const { error } = await supabase
      .from('event_types')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting event type:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (workspaceId) {
      await appendActivityLog(workspaceId, {
        type: 'event_type',
        action: 'deleted',
        entity_id: id,
        actor_user_id: user.id,
        title: 'Event type deleted',
        description: beforeEventType?.title
          ? `${beforeEventType.title} was removed`
          : `Event type ID ${id} was removed`,
        before_data: {
          title: beforeEventType?.title,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

