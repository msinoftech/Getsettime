import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, event_types(title, duration_minutes), contacts(name, phone, email)')
      .eq('public_code', code)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const workspaceId = booking.workspace_id;

    const [deptResult, providerResult, servicesResult, settingsResult, workspaceResult] = await Promise.all([
      booking.department_id
        ? supabase
            .from('departments')
            .select('id, name')
            .eq('id', booking.department_id)
            .single()
        : Promise.resolve({ data: null }),

      booking.service_provider_id
        ? supabase.auth.admin
            .getUserById(booking.service_provider_id)
            .then(({ data: { user } }) =>
              user
                ? {
                    data: {
                      id: user.id,
                      email: user.email ?? '',
                      raw_user_meta_data: {
                        full_name: user.user_metadata?.full_name,
                        name: user.user_metadata?.name,
                      },
                    },
                  }
                : { data: null }
            )
            .catch(() => ({ data: null }))
        : Promise.resolve({ data: null }),

      supabase
        .from('services')
        .select('id, name')
        .eq('workspace_id', workspaceId),

      supabase
        .from('workspace_settings')
        .select('intake_form')
        .eq('workspace_id', workspaceId)
        .single(),

      supabase
        .from('workspaces')
        .select('slug, user_id')
        .eq('id', workspaceId)
        .single(),
    ]);

    const department = deptResult.data
      ? { id: String(deptResult.data.id), name: deptResult.data.name }
      : null;

    const serviceProvider = providerResult.data
      ? {
          id: providerResult.data.id,
          email: providerResult.data.email,
          raw_user_meta_data: providerResult.data.raw_user_meta_data,
        }
      : null;

    const ownerUserId = workspaceResult.data?.user_id as string | null | undefined;
    let workspaceOwner: {
      id: string;
      email: string;
      raw_user_meta_data: { full_name?: string; name?: string };
    } | null = null;
    if (ownerUserId) {
      try {
        const { data: ownerData } = await supabase.auth.admin.getUserById(ownerUserId);
        const user = ownerData?.user;
        if (user) {
          workspaceOwner = {
            id: user.id,
            email: user.email ?? '',
            raw_user_meta_data: {
              full_name: user.user_metadata?.full_name,
              name: user.user_metadata?.name,
            },
          };
        }
      } catch {
        workspaceOwner = null;
      }
    }

    const { id: _id, workspace_id: _wid, host_user_id: _huid, ...safeBooking } = booking;

    return NextResponse.json({
      booking: safeBooking,
      department,
      serviceProvider,
      workspaceOwner,
      services: servicesResult.data ?? [],
      intakeFormSettings: settingsResult.data?.intake_form ?? null,
      workspace_slug: workspaceResult.data?.slug ?? null,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching public booking:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
