import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export interface AuthFromRequest {
  userId: string;
  workspaceId: number | null;
}

/**
 * Get user ID and workspace ID from request (from Authorization header or cookies)
 */
export async function getAuthFromRequest(req: Request): Promise<AuthFromRequest | null> {
  try {
    const token = await getTokenFromRequest(req);
    if (!token || !supabaseUrl || !supabaseAnonKey) return null;

    const verifyClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error } = await verifyClient.auth.getUser(token);
    if (error || !user) return null;

    const workspaceId = user.user_metadata?.workspace_id;
    return {
      userId: user.id,
      workspaceId: workspaceId != null ? Number(workspaceId) : null,
    };
  } catch (error) {
    console.error('Error getting auth from request:', error);
    return null;
  }
}

async function getTokenFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (token) return token;
  }
  const cookieStore = await cookies();
  return cookieStore.get('sb-access-token')?.value ?? null;
}

/**
 * Get user ID from request (from Authorization header or cookies)
 */
export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const auth = await getAuthFromRequest(req);
  return auth?.userId ?? null;
}

