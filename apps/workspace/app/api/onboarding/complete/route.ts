import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import {
  apply_onboarding_complete,
  resolve_onboarding_auth_context,
  sync_sp_event_type_location_deferred,
} from '@/lib/onboarding-persistence';

export async function POST(req: NextRequest) {
  try {
    const ctxOrError = await resolve_onboarding_auth_context(req);
    if ('error' in ctxOrError) {
      return NextResponse.json({ error: ctxOrError.error }, { status: ctxOrError.status });
    }

    const body = await req.json();
    const meetingOptionsIn = body?.meeting_options;
    if (!meetingOptionsIn || typeof meetingOptionsIn !== 'object') {
      return NextResponse.json({ error: 'meeting_options is required' }, { status: 400 });
    }

    const meetingOptions = {
      in_person: Boolean((meetingOptionsIn as Record<string, unknown>).in_person),
      phone_call: Boolean((meetingOptionsIn as Record<string, unknown>).phone_call),
      google_meet: Boolean((meetingOptionsIn as Record<string, unknown>).google_meet),
    };

    const result = await apply_onboarding_complete(ctxOrError, meetingOptions);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    after(async () => {
      try {
        await sync_sp_event_type_location_deferred(ctxOrError);
      } catch (e) {
        console.warn('onboarding complete location sync (non-critical):', e);
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('onboarding/complete:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
