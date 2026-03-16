import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { deleteIntegration, IntegrationType } from '@/lib/integrations';
import { updateUserGoogleMetadata } from '@/lib/auth-service';
import { getAuthFromRequest } from '@/lib/auth-helpers';

export async function POST(req: Request) {
  try {
    const auth = await getAuthFromRequest(req);
    const body = await req.json();
    const { type } = body;

    if (!auth?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!auth.workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 });
    }

    if (!type || !['google_calendar', 'zoom'].includes(type)) {
      return NextResponse.json({ error: 'Invalid integration type' }, { status: 400 });
    }

    const deleted = await deleteIntegration(auth.workspaceId, type as IntegrationType);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
    }

    // Sync user_metadata when disconnecting Google Calendar
    if (type === 'google_calendar') {
      const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
      const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '').trim();
      if (supabaseUrl && supabaseServiceKey) {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        await updateUserGoogleMetadata({
          userId: auth.userId,
          google_calendar_sync: false,
          supabaseAdmin,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Disconnect integration error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to disconnect' },
      { status: 500 }
    );
  }
}

