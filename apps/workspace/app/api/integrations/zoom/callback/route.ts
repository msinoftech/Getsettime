import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getZoomTokens } from '@/lib/zoomClient';
import { saveIntegration } from '@/lib/integrations';
import { getAuthFromRequest } from '@/lib/auth-helpers';
import axios from 'axios';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      return NextResponse.redirect(new URL('/integrations?error=missing_params', req.url));
    }

    let auth = await getAuthFromRequest(req);
    if (!auth?.workspaceId) {
      try {
        const raw = decodeURIComponent(state);
        const decoded = JSON.parse(Buffer.from(raw, 'base64').toString());
        if (decoded?.userId && decoded?.workspaceId) {
          auth = { userId: decoded.userId, workspaceId: Number(decoded.workspaceId) };
        }
      } catch {
        auth = auth ?? { userId: state, workspaceId: null };
        const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
        const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '').trim();
        if (auth.userId && supabaseUrl && supabaseServiceKey) {
          const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          const { data } = await supabaseAdmin.auth.admin.getUserById(auth.userId);
          const wid = data?.user?.user_metadata?.workspace_id;
          if (wid != null) auth.workspaceId = Number(wid);
        }
      }
    }
    if (!auth?.userId || !auth.workspaceId) {
      return NextResponse.redirect(new URL('/integrations?error=no_workspace', req.url));
    }

    const redirectUri = process.env.ZOOM_REDIRECT_URI || `${req.url.split('/callback')[0]}/callback`;

    // Exchange code for tokens
    const tokenResponse = await getZoomTokens(code, redirectUri);
    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    if (!access_token) {
      return NextResponse.redirect(new URL('/integrations?error=no_token', req.url));
    }

    // Get user info from Zoom
    const userResponse = await axios.get('https://api.zoom.us/v2/users/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const expiresAt = expires_in ? Date.now() / 1000 + expires_in : undefined;
    const result = await saveIntegration({
      workspace_id: auth.workspaceId,
      type: 'zoom',
      access_token,
      refresh_token,
      expires_at: expiresAt,
      metadata: {
        zoom_user_id: userResponse.data.id,
        zoom_email: userResponse.data.email,
      },
      provider_user_id: userResponse.data.id,
    });

    if (!result.ok) {
      const errParam = result.error ? `&message=${encodeURIComponent(result.error)}` : '';
      return NextResponse.redirect(new URL(`/integrations?error=save_failed${errParam}`, req.url));
    }

    return NextResponse.redirect(new URL('/integrations?success=zoom_connected', req.url));
  } catch (error: any) {
    console.error('Zoom callback error:', error);
    return NextResponse.redirect(new URL('/integrations?error=callback_failed', req.url));
  }
}

