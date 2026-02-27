import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';
import { createClient } from '@supabase/supabase-js';

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || null;

  if (!token) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const verifyClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: { user }, error } = await verifyClient.auth.getUser(token);
  if (error || !user) {
    return null;
  }

  return user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('configurations')
      .select('settings')
      .eq('workspace_id', workspaceId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If no configuration exists, return empty settings
    const settings = data?.settings || {};

    return NextResponse.json({ settings });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const body = await req.json();
    const { settings: newSettings } = body;

    if (!newSettings || typeof newSettings !== 'object') {
      return NextResponse.json({ error: 'Invalid settings data' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    // First, get existing configuration
    const { data: existingConfig, error: fetchError } = await supabase
      .from('configurations')
      .select('settings')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching existing settings:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Merge existing settings with new settings (new settings take precedence)
    const existingSettings = existingConfig?.settings || {};
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c18ea6a2-9a56-4a40-8939-326a1784f350',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:106',message:'Before merge',data:{existingSettings,newSettings,workspaceId},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    const mergedSettings = {
      ...existingSettings,
      ...newSettings,
      // Deep merge for nested objects
      general: {
        ...(existingSettings.general || {}),
        ...(newSettings.general || {}),
      },
      availability: {
        ...(existingSettings.availability || {}),
        ...(newSettings.availability || {}),
      },
      notifications: {
        ...(existingSettings.notifications || {}),
        ...(newSettings.notifications || {}),
      },
      intake_form: {
        ...(existingSettings.intake_form || {}),
        ...(newSettings.intake_form || {}),
      },
    };
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c18ea6a2-9a56-4a40-8939-326a1784f350',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:122',message:'After merge',data:{mergedSettings},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion

    // Update or insert configuration
    let data;
    let error;

    if (existingConfig) {
      // Update existing configuration
      const result = await supabase
        .from('configurations')
        .update({ settings: mergedSettings })
        .eq('workspace_id', workspaceId)
        .select('settings')
        .single();
      data = result.data;
      error = result.error;
    } else {
      // Insert new configuration
      const result = await supabase
        .from('configurations')
        .insert({
          workspace_id: workspaceId,
          settings: mergedSettings,
        })
        .select('settings')
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Error saving settings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    return NextResponse.json({ settings: data.settings });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

