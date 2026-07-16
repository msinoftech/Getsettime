import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  MANAGE_ROLES,
  ROLE_SERVICE_PROVIDER,
  ROLE_WORKSPACE_ADMIN,
} from '@/src/constants/roles';
import type {
  date_exception_availability_type,
  date_exception_category,
  date_exception_status,
} from '@/src/types/date_exceptions';

const AVAILABILITY_TYPES: readonly date_exception_availability_type[] = [
  'closed',
  'unavailable',
  'special_hours',
] as const;

const CATEGORIES: readonly date_exception_category[] = ['holiday', 'custom'] as const;

const STATUSES: readonly date_exception_status[] = ['active', 'inactive'] as const;

function createAuthenticatedClient(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function canManageAllExceptions(role: string | undefined, isOwner: boolean): boolean {
  if (isOwner) return true;
  if (!role) return false;
  return role === ROLE_WORKSPACE_ADMIN || MANAGE_ROLES.includes(role);
}

function normalizeTimeInput(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function validateExceptionPayload(body: Record<string, unknown>, partial = false) {
  const errors: string[] = [];

  let name: string | undefined;
  if ('name' in body || !partial) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      errors.push('Exception name is required');
    } else {
      name = body.name.trim().slice(0, 200);
    }
  }

  let exception_date: string | undefined;
  if ('exception_date' in body || !partial) {
    if (typeof body.exception_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.exception_date)) {
      errors.push('A valid date is required');
    } else {
      exception_date = body.exception_date;
    }
  }

  let availability_type: date_exception_availability_type | undefined;
  if ('availability_type' in body || !partial) {
    if (
      typeof body.availability_type !== 'string' ||
      !AVAILABILITY_TYPES.includes(body.availability_type as date_exception_availability_type)
    ) {
      errors.push('Availability type is required');
    } else {
      availability_type = body.availability_type as date_exception_availability_type;
    }
  }

  let exception_category: date_exception_category | undefined;
  if ('exception_category' in body) {
    if (
      typeof body.exception_category === 'string' &&
      CATEGORIES.includes(body.exception_category as date_exception_category)
    ) {
      exception_category = body.exception_category as date_exception_category;
    } else if (body.exception_category != null) {
      errors.push('Invalid exception category');
    }
  }

  let provider_id: string | null | undefined = undefined;
  if ('provider_id' in body) {
    if (body.provider_id === null || body.provider_id === '' || body.provider_id === undefined) {
      provider_id = null;
    } else if (typeof body.provider_id === 'string') {
      provider_id = body.provider_id.trim() || null;
    } else {
      errors.push('Invalid provider_id');
    }
  }

  let start_time: string | null | undefined = undefined;
  let end_time: string | null | undefined = undefined;
  if ('start_time' in body || 'end_time' in body || availability_type) {
    const needsTimes =
      availability_type === 'unavailable' || availability_type === 'special_hours';
    if (needsTimes || 'start_time' in body) {
      start_time = normalizeTimeInput(body.start_time);
    }
    if (needsTimes || 'end_time' in body) {
      end_time = normalizeTimeInput(body.end_time);
    }
    if (needsTimes && (!start_time || !end_time)) {
      errors.push('Start time and end time are required for this availability type');
    }
    if (start_time && end_time && start_time >= end_time) {
      errors.push('End time must be after start time');
    }
    if (availability_type === 'closed') {
      start_time = null;
      end_time = null;
    }
  }

  let repeat_yearly: boolean | undefined;
  if ('repeat_yearly' in body) {
    repeat_yearly = Boolean(body.repeat_yearly);
  }

  let notes: string | null | undefined = undefined;
  if ('notes' in body) {
    if (body.notes === null || body.notes === undefined) {
      notes = null;
    } else if (typeof body.notes === 'string') {
      notes = body.notes.slice(0, 200);
    } else {
      errors.push('Invalid notes');
    }
  }

  let status: date_exception_status | undefined;
  if ('status' in body) {
    if (
      typeof body.status === 'string' &&
      STATUSES.includes(body.status as date_exception_status)
    ) {
      status = body.status as date_exception_status;
    } else {
      errors.push('Invalid status');
    }
  }

  return {
    errors,
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(exception_date !== undefined ? { exception_date } : {}),
      ...(availability_type !== undefined ? { availability_type } : {}),
      ...(exception_category !== undefined ? { exception_category } : {}),
      ...(provider_id !== undefined ? { provider_id } : {}),
      ...(start_time !== undefined ? { start_time } : {}),
      ...(end_time !== undefined ? { end_time } : {}),
      ...(repeat_yearly !== undefined ? { repeat_yearly } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(status !== undefined ? { status } : {}),
    },
  };
}

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const supabase = createAuthenticatedClient(req);
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    const { id: idParam } = await context.params;
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from('date_exceptions')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (existingError) {
      console.error('Error loading date_exception:', existingError);
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Exception not found' }, { status: 404 });
    }

    const role = user.user_metadata?.role as string | undefined;
    const isOwner = Boolean(user.user_metadata?.is_workspace_owner);
    const manageAll = canManageAllExceptions(role, isOwner);

    if (!manageAll) {
      if (role !== ROLE_SERVICE_PROVIDER || existing.provider_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const body = (await req.json()) as Record<string, unknown>;
    const mergedAvailabilityType =
      (typeof body.availability_type === 'string'
        ? body.availability_type
        : existing.availability_type) as date_exception_availability_type;

    const { errors, data } = validateExceptionPayload(
      { ...body, availability_type: mergedAvailabilityType },
      true
    );
    if (errors.length > 0) {
      return NextResponse.json({ error: errors[0], errors }, { status: 400 });
    }

    const patch: Record<string, unknown> = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    if (!manageAll) {
      // Service providers cannot reassign scope away from themselves
      patch.provider_id = user.id;
    }

    const { data: updated, error } = await supabase
      .from('date_exceptions')
      .update(patch)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating date_exception:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ exception: updated });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error updating date_exception:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const supabase = createAuthenticatedClient(req);
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    const { id: idParam } = await context.params;
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from('date_exceptions')
      .select('id, provider_id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (existingError) {
      console.error('Error loading date_exception:', existingError);
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Exception not found' }, { status: 404 });
    }

    const role = user.user_metadata?.role as string | undefined;
    const isOwner = Boolean(user.user_metadata?.is_workspace_owner);
    const manageAll = canManageAllExceptions(role, isOwner);

    if (!manageAll) {
      if (role !== ROLE_SERVICE_PROVIDER || existing.provider_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { error } = await supabase
      .from('date_exceptions')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('Error deleting date_exception:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error deleting date_exception:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
