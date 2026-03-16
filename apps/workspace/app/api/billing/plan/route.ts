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

// GET - Fetch current plan
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
      console.error('Error fetching plan:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Default plan if not set
    const plan = data?.settings?.billing?.plan || {
      name: 'Pro',
      seats: 5,
      limits: 'Unlimited meetings',
      price: 1999,
    };

    return NextResponse.json({ plan });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

// POST - Update plan
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
    const { plan } = body;

    if (!plan || typeof plan !== 'object') {
      return NextResponse.json({ error: 'Invalid plan data' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    // Get existing configuration
    const { data: existingConfig, error: fetchError } = await supabase
      .from('configurations')
      .select('settings')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching existing settings:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Merge settings with new plan
    const existingSettings = existingConfig?.settings || {};
    const mergedSettings = {
      ...existingSettings,
      billing: {
        ...(existingSettings.billing || {}),
        plan: {
          name: plan.name,
          seats: plan.seats,
          limits: plan.limits,
          price: plan.price,
        },
        updatedAt: new Date().toISOString(),
      },
    };

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
      console.error('Error updating plan:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 });
    }

    return NextResponse.json({ 
      plan: data.settings.billing?.plan,
      message: 'Plan updated successfully' 
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

