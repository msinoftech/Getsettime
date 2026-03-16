import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = body?.access_token;
    if (!token) return NextResponse.json({ error: 'no token' }, { status: 400 });

    // Get Supabase URL and anon key for token verification
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'server configuration error' }, { status: 500 });
    }

    // Create a client with anon key to verify the token
    const verifyClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify token and get user - user_metadata is included in the JWT token
    const { data: { user }, error: userError } = await verifyClient.auth.getUser(token);

    if (userError || !user) {
      console.error('Token verification error:', userError);
      return NextResponse.json({ error: 'invalid token' }, { status: 401 });
    }

    const meta = user.user_metadata || {};
    const role = meta.role ?? '';
    const workspace_id = meta.workspace_id ?? '';

    // Set cookies (HttpOnly). Adjust cookie options (secure, sameSite, domain) for your deployment.
    const res = NextResponse.json({ ok: true });
    res.cookies.set('x_role', role, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'lax',
      path: '/' 
    });
    res.cookies.set('x_workspace_id', workspace_id, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'lax',
      path: '/' 
    });

    return res;
  } catch (err: any) {
    console.error('Session set error:', err);
    return NextResponse.json({ 
      error: err?.message || 'server error' 
    }, { status: 500 });
  }
}

