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

// PUT - Update a workspace
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both sync and async params (Next.js 15+)
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    const body = await req.json();
    const { name, slug, primary_color, accent_color, logo_url, billing_customer_id } = body;

    // Validation
    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9_-]+$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json({ 
        error: 'Slug must contain only lowercase letters, numbers, hyphens, and underscores' 
      }, { status: 400 });
    }

    // Validate color format if provided
    if (primary_color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(primary_color)) {
      return NextResponse.json({ error: 'Primary color must be a valid hex color' }, { status: 400 });
    }

    if (accent_color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(accent_color)) {
      return NextResponse.json({ error: 'Accent color must be a valid hex color' }, { status: 400 });
    }

    const supabaseServer = getSupabaseServer();

    // Check if slug already exists for another workspace
    const { data: existing } = await supabaseServer
      .from('workspaces')
      .select('id')
      .eq('slug', slug)
      .neq('id', id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }

    // Update workspace
    console.log('Updating workspace', id, 'with logo_url:', logo_url);
    const { data, error } = await supabaseServer
      .from('workspaces')
      .update({
        name,
        slug,
        logo_url: logo_url || null,
        billing_customer_id: billing_customer_id || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating workspace:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
      }
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

    console.log('Workspace updated successfully. Saved logo_url:', data?.logo_url);
    return NextResponse.json({ workspace: data }, { status: 200 });
  } catch (err: any) {
    console.error('PUT workspace error:', err);
    return NextResponse.json({ 
      error: err?.message || 'An unexpected error occurred' 
    }, { status: 500 });
  }
}

// DELETE - Delete a workspace
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both sync and async params (Next.js 15+)
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;

    const supabaseServer = getSupabaseServer();

    const { error } = await supabaseServer
      .from('workspaces')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting workspace:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Workspace deleted successfully' }, { status: 200 });
  } catch (err: any) {
    console.error('DELETE workspace error:', err);
    return NextResponse.json({ 
      error: err?.message || 'An unexpected error occurred' 
    }, { status: 500 });
  }
}

