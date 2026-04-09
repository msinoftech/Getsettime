import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { BOOKING_STATUSES } from '@app/db';
import { user_belongs_to_workspace } from '@/lib/team_members_workspace';

function create_user_supabase(token: string): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}

function create_admin_client(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Next calendar day in UTC as YYYY-MM-DD (for exclusive end bound). */
function next_utc_yyyy_mm_dd(yyyy_mm_dd: string): string {
  const [y, m, d] = yyyy_mm_dd.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

const WEEK_DAYS_RE = /^(\d{4}-\d{2}-\d{2})(,\d{4}-\d{2}-\d{2}){6}$/;

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = create_user_supabase(token);
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const weekDaysRaw = searchParams.get('week_days') || '';
    if (!WEEK_DAYS_RE.test(weekDaysRaw)) {
      return NextResponse.json(
        { error: 'Invalid or missing week_days (expect 7 comma-separated YYYY-MM-DD)' },
        { status: 400 }
      );
    }
    const weekDays = weekDaysRaw.split(',');

    const knownStatusValues = BOOKING_STATUSES.map((s) => s.value);
    const inList = `(${knownStatusValues.map((k) => `"${k}"`).join(',')})`;

    const dayCountPromises = weekDays.map((day) => {
      const start = `${day}T00:00:00.000Z`;
      const endDay = next_utc_yyyy_mm_dd(day);
      const end = `${endDay}T00:00:00.000Z`;
      return supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('start_at', start)
        .lt('start_at', end);
    });

    const statusCountPromises = knownStatusValues.map((status) =>
      supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('status', status)
    );

    const nullStatusPromise = supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .is('status', null);

    const otherStatusPromise = supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .not('status', 'is', null)
      .not('status', 'in', inList);

    const totalPromise = supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    const nowIso = new Date().toISOString();
    const upcomingPromise = supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .gt('start_at', nowIso);

    const servicesPromise = supabase
      .from('services')
      .select('id, name, departments(name)')
      .order('created_at', { ascending: false });

    const userRole = user.user_metadata?.role as string | undefined;
    const canSeeTeam = userRole === 'workspace_admin' || userRole === 'manager';

    const teamCountPromise = (async (): Promise<
      | { kind: 'forbidden' }
      | { kind: 'ok'; count: number }
      | { kind: 'fail'; message: string }
    > => {
      if (!canSeeTeam) return { kind: 'forbidden' };
      const admin = create_admin_client();
      if (!admin) return { kind: 'fail', message: 'Server configuration error' };
      const { data: listData, error: listError } = await admin.auth.admin.listUsers();
      if (listError || !listData?.users) {
        console.error('Dashboard summary: listUsers error', listError);
        return { kind: 'fail', message: listError?.message || 'Failed to list team members' };
      }
      const count = listData.users.filter((u) => user_belongs_to_workspace(u, workspaceId)).length;
      return { kind: 'ok', count };
    })();

    const [
      dayResults,
      statusResults,
      nullStatusResult,
      otherStatusResult,
      totalResult,
      upcomingResult,
      servicesResult,
      teamMembersResult,
    ] = await Promise.all([
      Promise.all(dayCountPromises),
      Promise.all(statusCountPromises),
      nullStatusPromise,
      otherStatusPromise,
      totalPromise,
      upcomingPromise,
      servicesPromise,
      teamCountPromise,
    ]);

    if (teamMembersResult.kind === 'fail') {
      return NextResponse.json({ error: teamMembersResult.message }, { status: 500 });
    }
    const team_members_count =
      teamMembersResult.kind === 'forbidden' ? null : teamMembersResult.count;

    for (const r of dayResults) {
      if (r.error) {
        console.error('Dashboard summary day count:', r.error);
        return NextResponse.json({ error: r.error.message }, { status: 500 });
      }
    }
    for (const r of statusResults) {
      if (r.error) {
        console.error('Dashboard summary status count:', r.error);
        return NextResponse.json({ error: r.error.message }, { status: 500 });
      }
    }
    if (nullStatusResult.error) {
      console.error('Dashboard summary null status:', nullStatusResult.error);
      return NextResponse.json({ error: nullStatusResult.error.message }, { status: 500 });
    }
    if (otherStatusResult.error) {
      console.error('Dashboard summary other status:', otherStatusResult.error);
      return NextResponse.json({ error: otherStatusResult.error.message }, { status: 500 });
    }
    if (totalResult.error) {
      console.error('Dashboard summary total:', totalResult.error);
      return NextResponse.json({ error: totalResult.error.message }, { status: 500 });
    }
    if (upcomingResult.error) {
      console.error('Dashboard summary upcoming:', upcomingResult.error);
      return NextResponse.json({ error: upcomingResult.error.message }, { status: 500 });
    }
    if (servicesResult.error) {
      console.error('Dashboard summary services:', servicesResult.error);
      return NextResponse.json({ error: servicesResult.error.message }, { status: 500 });
    }

    const bookings_by_day = dayResults.map((r) => r.count ?? 0);

    const bookings_by_status: Record<string, number> = {};
    knownStatusValues.forEach((status, i) => {
      bookings_by_status[status] = statusResults[i].count ?? 0;
    });
    const nullPending = nullStatusResult.count ?? 0;
    bookings_by_status.pending = (bookings_by_status.pending ?? 0) + nullPending;

    const otherCount = otherStatusResult.count ?? 0;
    if (otherCount > 0) {
      bookings_by_status.other = otherCount;
    }

    const servicesRaw = (servicesResult.data ?? []) as Array<{
      id: string;
      name: string;
      departments?: { name: string } | { name: string }[] | null;
    }>;
    const services = servicesRaw.map((s) => {
      const d = s.departments;
      const department_name =
        d == null
          ? null
          : Array.isArray(d)
            ? (d[0]?.name ?? null)
            : (d.name ?? null);
      return { id: String(s.id), name: s.name, department_name };
    });

    return NextResponse.json({
      bookings_total: totalResult.count ?? 0,
      upcoming_bookings_count: upcomingResult.count ?? 0,
      bookings_by_day,
      bookings_by_status,
      team_members_count,
      services,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Dashboard summary:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
