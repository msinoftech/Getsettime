import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getWorkspaceIntegrations } from '@/lib/integrations';
import { getAuthFromRequest } from '@/lib/auth-helpers';

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
    const googleIntegration = integrations.find(i => i.provider === 'google_calendar');

    let googleCalendarEmail: string | undefined;
    const config = googleIntegration?.config as Record<string, unknown> | undefined;
    if (config?.email) {
      googleCalendarEmail = config.email as string;
    } else {
      const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
      const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '').trim();
      if (supabaseUrl && supabaseServiceKey) {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(auth.userId);
        const meta = userData?.user?.user_metadata as Record<string, unknown> | undefined;
        if (meta?.google_email) {
          googleCalendarEmail = meta.google_email as string;
        }
      }
    }

    const status = {
      google_calendar: !!googleIntegration,
      zoom: integrations.some(i => i.provider === 'zoom'),
      google_calendar_email: googleCalendarEmail,
    };

    return NextResponse.json({ integrations: status });
  } catch (error: any) {
    console.error('Get integrations status error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get integrations' },
      { status: 500 }
    );
  }
}

