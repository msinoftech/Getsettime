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
    // The anon key allows us to verify tokens issued by Supabase
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
      // Return a more descriptive error message
      const errorMessage = userError?.message || 'Token verification failed';
      return NextResponse.json({ 
        error: errorMessage.includes('JWT') || errorMessage.includes('token') 
          ? 'token invalid' 
          : errorMessage 
      }, { status: 401 });
    }

    // Extract user metadata from the verified user (JWT contains user_metadata)
    const userId = user.id;
    const meta = user.user_metadata || {};

    return NextResponse.json({
      user_id: userId,
      role: meta.role ?? null,
      workspace_id: meta.workspace_id ?? null,
      deactivated: meta.deactivated === true
    });
  } catch (err: any) {
    console.error('Verification error:', err);
    return NextResponse.json({ 
      error: err?.message || 'server error' 
    }, { status: 500 });
  }
}

