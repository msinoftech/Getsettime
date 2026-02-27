import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET - Fetch paginated bookings across all workspaces
export async function GET(request: NextRequest) {
  try {
    const supabaseServer = getSupabaseServer();
    const searchParams = request.nextUrl.searchParams;
    
    // Parse pagination parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;
    
    // Parse sorting parameters
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const ascending = sortOrder === 'asc';
    
    // Parse filter parameters
    const filter = searchParams.get('filter') || '';
    const date = searchParams.get('date') || '';
    const status = searchParams.get('status') || '';
    const eventTypeId = searchParams.get('event_type_id') || '';
    const workspaceId = searchParams.get('workspace_id') || '';
    
    // Build query with event_types join to get event type title
    let query = supabaseServer
      .from('bookings')
      .select('*, event_types(title)', { count: 'exact' });
    
    // Apply search filter if provided (search in invitee_name, invitee_email, or workspace name)
    if (filter) {
      const filterPattern = `%${filter}%`;
      
      // First, check if filter matches any workspace names
      const { data: matchingWorkspaces } = await supabaseServer
        .from('workspaces')
        .select('id')
        .ilike('name', filterPattern);
      
      const workspaceIds = matchingWorkspaces?.map(w => w.id) || [];
      
      // Build filter: name/email OR workspace_id in matching workspaces
      if (workspaceIds.length > 0) {
        // Use or() with in() for workspace IDs
        query = query.or(`invitee_name.ilike.${filterPattern},invitee_email.ilike.${filterPattern},workspace_id.in.(${workspaceIds.join(',')})`);
      } else {
        // Only filter by name/email if no workspace matches
        query = query.or(`invitee_name.ilike.${filterPattern},invitee_email.ilike.${filterPattern}`);
      }
    }

    // Apply date filter if provided (fetch bookings for a specific date)
    if (date) {
      const dateObj = new Date(date);
      const startOfDay = new Date(dateObj);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateObj);
      endOfDay.setHours(23, 59, 59, 999);
      
      query = query
        .gte('start_at', startOfDay.toISOString())
        .lte('start_at', endOfDay.toISOString());
    }

    // Apply status filter if provided
    if (status.trim()) {
      query = query.eq('status', status.trim());
    }

    // Apply event type filter if provided
    if (eventTypeId.trim()) {
      query = query.eq('event_type_id', eventTypeId.trim());
    }

    // Apply workspace filter if provided
    if (workspaceId.trim()) {
      query = query.eq('workspace_id', workspaceId.trim());
    }
    
    // Apply sorting
    const validSortFields: Record<string, string> = {
      'date': 'start_at',
      'name': 'invitee_name',
      'workspace': 'workspace_id',
      'created_at': 'created_at',
    };
    
    const sortField = validSortFields[sortBy] || 'start_at';
    query = query.order(sortField, { ascending });
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1);
    
    const { data: bookings, error, count } = await query;

    if (error) {
      console.error('Error fetching bookings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const totalPages = count ? Math.ceil(count / limit) : 0;

    return NextResponse.json({ 
      bookings: bookings || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
      }
    }, { status: 200 });
  } catch (err: any) {
    console.error('GET bookings error:', err);
    return NextResponse.json({ 
      error: err?.message || 'An unexpected error occurred' 
    }, { status: 500 });
  }
}

