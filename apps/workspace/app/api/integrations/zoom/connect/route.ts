import { NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/auth-helpers';

export async function GET(req: Request) {
  try {
    const auth = await getAuthFromRequest(req);

    if (!auth?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!auth.workspaceId) {
      return NextResponse.json(
        { error: 'Workspace not found. Please complete onboarding first.' },
        { status: 400 }
      );
    }

    const clientId = process.env.ZOOM_CLIENT_ID;
    const redirectUri = process.env.ZOOM_REDIRECT_URI || `${req.url.split('/api')[0]}/api/integrations/zoom/callback`;

    if (!clientId) {
      return NextResponse.json({ error: 'Zoom client ID not configured' }, { status: 500 });
    }

    const state = Buffer.from(JSON.stringify({ userId: auth.userId, workspaceId: auth.workspaceId })).toString('base64');
    const authUrl = `https://zoom.us/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

    return NextResponse.json({ authUrl });
  } catch (error: any) {
    console.error('Zoom OAuth error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}

