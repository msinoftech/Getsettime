import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = body?.access_token;
    if (!token) return NextResponse.json({ error: 'no token' }, { status: 400 });

    // Get Supabase server client
    let supabaseServer;
    try {
      supabaseServer = getSupabaseServer();
    } catch (initError: any) {
      console.error('Supabase initialization error:', initError);
      return NextResponse.json({ error: 'server configuration error' }, { status: 500 });
    }

    // Get Supabase URL and anon key for token verification
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
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

    // Verify token and get user - this works with anon key
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

    // Get full user data with metadata using admin API (service role)
    const { data: adminUser, error: adminError } = await supabaseServer.auth.admin.getUserById(user.id);

    if (adminError || !adminUser) {
      console.error('Admin API error:', adminError);
      // Fallback to user data from token verification
      const userId = user.id;
      const meta = user.user_metadata || {};
      
      return NextResponse.json({
        user_id: userId,
        role: meta.role ?? null,
        workspace_id: meta.workspace_id ?? null
      });
    }

    // Use admin API data which has complete user metadata
    const userId = adminUser.user.id;
    const meta = adminUser.user.user_metadata || {};

    return NextResponse.json({
      user_id: userId,
      role: meta.role ?? null,
      workspace_id: meta.workspace_id ?? null
    });
  } catch (err: any) {
    console.error('Verification error:', err);
    return NextResponse.json({ 
      error: err?.message || 'server error' 
    }, { status: 500 });
  }
}

