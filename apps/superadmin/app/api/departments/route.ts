import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET - Fetch distinct list of all department names across all workspaces
export async function GET() {
  try {
    const supabaseServer = getSupabaseServer();
    
    // Query all departments from all workspaces
    // Service role key bypasses RLS, so we get departments from all workspaces
    const { data: departments, error } = await supabaseServer
      .from('departments')
      .select('name')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching departments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get distinct department names
    const distinctNames = [...new Set((departments || []).map(dept => dept.name))];

    return NextResponse.json({ 
      departments: distinctNames
    }, { status: 200 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('GET departments error:', error);
    return NextResponse.json({ 
      error: error?.message || 'An unexpected error occurred' 
    }, { status: 500 });
  }
}
