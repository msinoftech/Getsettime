import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabaseServer';

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const mergeSettings = (existing: JsonObject, updates: JsonObject): JsonObject => {
  const merged: JsonObject = { ...existing };

  Object.entries(updates).forEach(([key, value]) => {
    if (isObject(value)) {
      const current = isObject(existing[key]) ? (existing[key] as JsonObject) : {};
      merged[key] = { ...current, ...value };
    } else {
      merged[key] = value;
    }
  });

  return merged;
};

async function upsertConfiguration(
  supabase: SupabaseClient,
  workspaceId: string,
  updates: JsonObject
) {
  const { data: existingConfig, error: fetchError } = await supabase
    .from('configurations')
    .select('id, settings')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw new Error(fetchError.message);
  }

  const mergedSettings = mergeSettings(existingConfig?.settings ?? {}, updates);

  const result = existingConfig
    ? await supabase
        .from('configurations')
        .update({ settings: mergedSettings })
        .eq('workspace_id', workspaceId)
        .select('settings')
        .single()
    : await supabase
        .from('configurations')
        .insert({ workspace_id: workspaceId, settings: mergedSettings })
        .select('settings')
        .single();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data?.settings;
}

// GET - Fetch all workspaces
export async function GET() {
  try {
    const supabaseServer = getSupabaseServer();
    
    const { data: workspacesData, error: workspacesError } = await supabaseServer
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false });

    if (workspacesError) {
      console.error('Error fetching workspaces:', workspacesError);
      return NextResponse.json({ error: workspacesError.message }, { status: 500 });
    }

    // Fetch configurations for all workspaces
    const workspaceIds = (workspacesData || []).map(w => w.id);
    const { data: configurationsData, error: configsError } = workspaceIds.length > 0
      ? await supabaseServer
          .from('configurations')
          .select('workspace_id, settings')
          .in('workspace_id', workspaceIds)
      : { data: [], error: null };

    if (configsError) {
      console.error('Error fetching configurations:', configsError);
      // Continue without configurations if fetch fails
    }

    // Create a map of workspace_id -> settings
    const configsMap = new Map(
      (configurationsData || []).map(config => [config.workspace_id, config.settings])
    );

    // Merge workspace data with configuration colors
    const workspaces = (workspacesData || []).map(workspace => {
      const configSettings = configsMap.get(workspace.id);
      const generalSettings = configSettings?.general || {};
      
      // Prioritize colors from configurations, fallback to workspaces table
      return {
        ...workspace,
        primary_color: generalSettings.primaryColor || workspace.primary_color,
        accent_color: generalSettings.accentColor || workspace.accent_color,
      };
    });

    return NextResponse.json({ workspaces }, { status: 200 });
  } catch (err: any) {
    console.error('GET workspaces error:', err);
    return NextResponse.json({ 
      error: err?.message || 'An unexpected error occurred' 
    }, { status: 500 });
  }
}

// POST - Create a new workspace
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, slug, primary_color, accent_color, logo_url, billing_customer_id, admin_email, admin_password, admin_name } = body;

    // Validation
    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Validate user fields if provided
    if (admin_email || admin_password || admin_name) {
      if (!admin_email || !admin_password || !admin_name) {
        return NextResponse.json({ 
          error: 'Admin email, password, and name are all required when creating a workspace admin user' 
        }, { status: 400 });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(admin_email)) {
        return NextResponse.json({ error: 'Invalid admin email format' }, { status: 400 });
      }

      // Validate password length
      if (admin_password.length < 6) {
        return NextResponse.json({ 
          error: 'Admin password must be at least 6 characters' 
        }, { status: 400 });
      }
    }

    // Validate slug format (alphanumeric, hyphens, underscores only)
    const slugRegex = /^[a-z0-9_-]+$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json({ 
        error: 'Slug must contain only lowercase letters, numbers, hyphens, and underscores' 
      }, { status: 400 });
    }

    // Validate color format if provided (hex color)
    if (primary_color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(primary_color)) {
      return NextResponse.json({ error: 'Primary color must be a valid hex color' }, { status: 400 });
    }

    if (accent_color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(accent_color)) {
      return NextResponse.json({ error: 'Accent color must be a valid hex color' }, { status: 400 });
    }

    const supabaseServer = getSupabaseServer();

    // Check if slug already exists
    const { data: existing } = await supabaseServer
      .from('workspaces')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }

    // Create workspace
    console.log('Creating workspace with logo_url:', logo_url);
    const { data, error } = await supabaseServer
      .from('workspaces')
      .insert({
        name,
        slug,
        logo_url: logo_url || null,
        billing_customer_id: billing_customer_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating workspace:', error);
      // Handle unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data?.id) {
      const generalSettings: JsonObject = {
        general: {
          accountName: name,
          primaryColor: primary_color || null,
          accentColor: accent_color || null,
          logoUrl: logo_url || null,
        },
      };

      await upsertConfiguration(supabaseServer, data.id, generalSettings);
    }

    // Create workspace_admin user if user fields are provided
    let createdUser = null;
    if (admin_email && admin_password && admin_name && data) {
      try {
        const userMetadata: Record<string, any> = {
          name: admin_name,
          role: 'workspace_admin',
          workspace_id: data.id,
        };

        const { data: userData, error: createUserError } = await supabaseServer.auth.admin.createUser({
          email: admin_email,
          password: admin_password,
          email_confirm: true, // Auto-confirm email
          user_metadata: userMetadata,
        });

        if (createUserError) {
          console.error('Error creating workspace admin user:', createUserError);
          // If user creation fails, we should rollback workspace creation
          // But for now, we'll just log the error and return the workspace
          // In production, you might want to delete the workspace if user creation fails
          return NextResponse.json({ 
            error: `Workspace created but failed to create admin user: ${createUserError.message}`,
            workspace: data 
          }, { status: 201 });
        }

        if (userData && userData.user) {
          createdUser = {
            id: userData.user.id,
            email: userData.user.email,
            name: userData.user.user_metadata?.name || null,
            role: userData.user.user_metadata?.role || null,
            workspace_id: userData.user.user_metadata?.workspace_id || null,
          };
          console.log('Workspace admin user created successfully');
        }
      } catch (userErr: any) {
        console.error('Error creating workspace admin user:', userErr);
        // Return workspace even if user creation fails
        return NextResponse.json({ 
          error: `Workspace created but failed to create admin user: ${userErr?.message || 'Unknown error'}`,
          workspace: data 
        }, { status: 201 });
      }
    }

    console.log('Workspace created successfully. Saved logo_url:', data?.logo_url);
    return NextResponse.json({ 
      workspace: data,
      user: createdUser,
      message: createdUser ? 'Workspace and admin user created successfully' : 'Workspace created successfully'
    }, { status: 201 });
  } catch (err: any) {
    console.error('POST workspace error:', err);
    return NextResponse.json({ 
      error: err?.message || 'An unexpected error occurred' 
    }, { status: 500 });
  }
}

