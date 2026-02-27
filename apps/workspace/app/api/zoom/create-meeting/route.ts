import { NextResponse } from 'next/server';
import axios from 'axios';
import { getAuthFromRequest } from '@/lib/auth-helpers';
import { getIntegration } from '@/lib/integrations';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const auth = await getAuthFromRequest(req);

    if (!auth?.userId && !authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { topic, start_time, duration, timezone, settings } = body;

    let accessToken = authHeader?.replace('Bearer ', '');

    if (!accessToken) {
      if (!auth?.workspaceId) {
        return NextResponse.json({ error: 'No workspace found' }, { status: 400 });
      }
      const integration = await getIntegration(auth.workspaceId, 'zoom');
      if (!integration) {
        return NextResponse.json({ error: 'Zoom not connected' }, { status: 400 });
      }
      accessToken = integration.access_token;
    }

    // Create Zoom meeting
    const response = await axios.post(
      'https://api.zoom.us/v2/users/me/meetings',
      {
        topic: topic || 'Meeting',
        type: 2, // Scheduled meeting
        start_time,
        duration,
        timezone,
        settings: {
          join_before_host: true,
          waiting_room: false,
          ...settings,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return NextResponse.json({
      success: true,
      meeting_id: response.data.id,
      join_url: response.data.join_url,
      start_url: response.data.start_url,
    });
  } catch (error: any) {
    console.error('Create Zoom meeting error:', error);
    return NextResponse.json(
      { error: error.response?.data?.message || error.message || 'Failed to create meeting' },
      { status: error.response?.status || 500 }
    );
  }
}

