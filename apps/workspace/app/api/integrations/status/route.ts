import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getWorkspaceIntegrations,
  getLinkedAuthUserIdFromConfig,
} from '@/lib/integrations';
import { getAuthFromRequest } from '@/lib/auth-helpers';
import { ROLE_SERVICE_PROVIDER } from '@/src/constants/roles';

export async function GET(req: Request) {
  try {
    const auth = await getAuthFromRequest(req);

    if (!auth?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!auth.workspaceId) {
      return NextResponse.json({
        integrations: {
          google_calendar: false,
          zoom: false,
          google_calendar_email: undefined,
        },
      });
    }

    const integrations = await getWorkspaceIntegrations(auth.workspaceId);
    const googleRows = integrations.filter((i) => i.provider === 'google_calendar');

    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    let userRole: string | undefined;
    if (supabaseUrl && supabaseServiceKey) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(auth.userId);
      userRole = userData?.user?.user_metadata?.role as string | undefined;
    }

    const isServiceProvider = userRole === ROLE_SERVICE_PROVIDER;
    const googleIntegration = isServiceProvider
      ? googleRows.find(
          (i) => getLinkedAuthUserIdFromConfig(i.config as Record<string, unknown>) === auth.userId
        )
      : googleRows.find(
          (i) => !getLinkedAuthUserIdFromConfig(i.config as Record<string, unknown>)
        );

    let googleCalendarEmail: string | undefined;
    const config = googleIntegration?.config as Record<string, unknown> | undefined;
    if (config?.email && typeof config.email === 'string') {
      googleCalendarEmail = config.email;
    } else if (isServiceProvider && supabaseUrl && supabaseServiceKey) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(auth.userId);
      const meta = userData?.user?.user_metadata as Record<string, unknown> | undefined;
      if (typeof meta?.google_email === 'string') {
        googleCalendarEmail = meta.google_email;
      }
    }

    const status = {
      google_calendar: !!googleIntegration,
      zoom: integrations.some((i) => i.provider === 'zoom'),
      google_calendar_email: googleCalendarEmail,
    };

    return NextResponse.json({ integrations: status });
  } catch (error: unknown) {
    console.error('Get integrations status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get integrations' },
      { status: 500 }
    );
  }
}
