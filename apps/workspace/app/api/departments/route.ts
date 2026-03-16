import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Creates an authenticated Supabase client using the anon key (respects RLS)
 * Sets the auth session from the request's bearer token
 */
function createAuthenticatedClient(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  // Create client with anon key - respects RLS policies
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  return { supabase, token };
}

// GET: Fetch all departments for the workspace
export async function GET(req: NextRequest) {
  try {
    const result = createAuthenticatedClient(req);
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, token } = result;

    // Verify auth - will fail if token is invalid
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // RLS automatically filters by workspace_id from JWT
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching departments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ departments: data || [] });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

// POST: Create a new department
export async function POST(req: NextRequest) {
  try {
    const result = createAuthenticatedClient(req);
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, token } = result;

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, meta_data } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    // RLS validates workspace_id matches JWT; we provide it for INSERT WITH CHECK policy
    // Prepare meta_data - ensure it's a plain object, not a string
    let finalMetaData: Record<string, unknown> | null = null;
    
    if (meta_data) {
      if (typeof meta_data === 'string') {
        // If it's a string, try to parse it
        try {
          finalMetaData = JSON.parse(meta_data);
        } catch {
          finalMetaData = { services: [] };
        }
      } else if (typeof meta_data === 'object' && meta_data !== null && !Array.isArray(meta_data)) {
        // If it's already an object, use it directly
        finalMetaData = meta_data as Record<string, unknown>;
      } else {
        finalMetaData = { services: [] };
      }
    } else {
      // If no meta_data provided, set to null (or empty object)
      finalMetaData = { services: [] };
    }
    
    console.log('=== CREATE DEPARTMENT DEBUG ===');
    console.log('Raw body received:', JSON.stringify(body));
    console.log('Raw meta_data received:', meta_data);
    console.log('meta_data type:', typeof meta_data);
    console.log('meta_data is string?', typeof meta_data === 'string');
    console.log('meta_data is object?', typeof meta_data === 'object' && meta_data !== null);
    console.log('finalMetaData:', finalMetaData);
    console.log('finalMetaData type:', typeof finalMetaData);
    console.log('finalMetaData stringified:', JSON.stringify(finalMetaData));

    // Supabase jsonb columns expect a JavaScript object/array, not a JSON string
    // Create the insert payload
    const insertPayload = {
      workspace_id: workspaceId,
      name: name.trim(),
      description: description?.trim() || null,
      meta_data: finalMetaData,
    };
    
    console.log('Insert payload:', JSON.stringify(insertPayload, null, 2));
    console.log('Insert payload.meta_data type:', typeof insertPayload.meta_data);
    
    const { data, error } = await supabase
      .from('departments')
      .insert(insertPayload)
      .select()
      .single();
    
    if (error) {
      console.error('Supabase insert error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    } else {
      console.log('Successfully created department:', data);
      console.log('Created department meta_data:', data.meta_data);
      console.log('Created department meta_data type:', typeof data.meta_data);
    }

    if (error) {
      console.error('Error creating department:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ department: data });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

// PUT: Update an existing department
export async function PUT(req: NextRequest) {
  try {
    const result = createAuthenticatedClient(req);
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, token } = result;

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, description, meta_data } = body;

    if (!id) {
      return NextResponse.json({ error: 'Department ID is required' }, { status: 400 });
    }

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    // Fetch existing department to merge meta_data
    const { data: existing, error: fetchError } = await supabase
      .from('departments')
      .select('meta_data')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Department not found or unauthorized' }, { status: 404 });
    }

    // Parse incoming meta_data if it's a string
    let parsedMetaData: Record<string, unknown> | null = null;
    if (meta_data) {
      if (typeof meta_data === 'string') {
        try {
          parsedMetaData = JSON.parse(meta_data);
        } catch {
          parsedMetaData = null;
        }
      } else if (typeof meta_data === 'object' && meta_data !== null && !Array.isArray(meta_data)) {
        parsedMetaData = meta_data as Record<string, unknown>;
      }
    }

    // Merge meta_data: preserve existing keys, update services
    const existingMetaData = (existing.meta_data as Record<string, unknown>) || {};
    let mergedMetaData: Record<string, unknown>;
    
    if (parsedMetaData && 'services' in parsedMetaData) {
      // If meta_data with services is provided, merge it with existing
      mergedMetaData = {
        ...existingMetaData,
        // Explicitly set services array (even if empty) - this ensures services are always saved
        services: Array.isArray(parsedMetaData.services) ? parsedMetaData.services : [],
      };
    } else {
      // If no meta_data provided, keep existing
      mergedMetaData = existingMetaData;
    }
    
    console.log('Updating department - existing meta_data:', existingMetaData);
    console.log('Updating department - incoming meta_data:', meta_data);
    console.log('Updating department - parsed meta_data:', parsedMetaData);
    console.log('Updating department - merged meta_data:', mergedMetaData);
    console.log('Updating department - merged meta_data JSON:', JSON.stringify(mergedMetaData));

    // RLS automatically filters by workspace_id from JWT
    // Supabase jsonb columns expect a JavaScript object/array, not a JSON string
    // Pass the object directly - Supabase will handle the JSON conversion
    const { data, error } = await supabase
      .from('departments')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        meta_data: mergedMetaData, // Pass as object, Supabase handles jsonb conversion
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating department:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Department not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ department: data });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

// DELETE: Delete a department
export async function DELETE(req: NextRequest) {
  try {
    const result = createAuthenticatedClient(req);
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, token } = result;

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Department ID is required' }, { status: 400 });
    }

    // RLS automatically filters by workspace_id from JWT
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting department:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

