import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';
import {
  resolveNotificationsForServiceProvider,
  resolveMeetingOptionsForServiceProvider,
} from '@/src/utils/providerSettingsResolution';
import { resolve_booking_step_order } from '@/src/features/booking-flow/resolve_booking_step_order';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceSlug = searchParams.get('workspace_slug');
    const workspaceId = searchParams.get('workspace_id');
    const serviceProviderId = searchParams.get('service_provider_id')?.trim() || '';

    if (!workspaceSlug && !workspaceId) {
      return NextResponse.json(
        { error: 'Workspace slug or ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();
    let workspaceIdResolved: string | null = null;

    // Resolve workspace ID from slug if needed
    if (workspaceSlug && !workspaceId) {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('slug', workspaceSlug)
        .single();

      if (!workspace) {
        return NextResponse.json(
          { error: 'Workspace not found' },
          { status: 404 }
        );
      }

      workspaceIdResolved = workspace.id;
    } else if (workspaceId) {
      workspaceIdResolved = workspaceId;
    }

    if (!workspaceIdResolved) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Fetch settings
    const { data, error } = await supabase
      .from('configurations')
      .select('settings')
      .eq('workspace_id', workspaceIdResolved)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const settings = (data?.settings || {}) as Record<string, unknown>;

    const { data: workspace_row } = await supabase
      .from('workspaces')
      .select('profession_id, professions(admin_professions_id)')
      .eq('id', workspaceIdResolved)
      .maybeSingle();
    const profession = workspace_row?.professions as
      | { admin_professions_id?: number | null }
      | { admin_professions_id?: number | null }[]
      | null
      | undefined;
    const admin_professions_id = Array.isArray(profession)
      ? profession[0]?.admin_professions_id ?? null
      : profession?.admin_professions_id ?? null;
    const booking_step_order = await resolve_booking_step_order({
      supabase,
      admin_professions_id,
    });

    if (serviceProviderId) {
      return NextResponse.json({
        settings: {
          ...settings,
          notifications: resolveNotificationsForServiceProvider(
            settings.notifications as Record<string, unknown>,
            serviceProviderId
          ),
          meeting_options: resolveMeetingOptionsForServiceProvider(
            settings.meeting_options as Record<string, unknown>,
            serviceProviderId
          ),
        },
        booking_step_order,
      });
    }

    return NextResponse.json({ settings, booking_step_order });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}

