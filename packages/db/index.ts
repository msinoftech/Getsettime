import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '@app/config';

/**
 * Client-side Supabase client
 * Uses anon key for client-side operations
 * WARNING: Service role key should NEVER be used in client-side code!
 * Use createSupabaseServerClient() in server-side API routes for admin operations.
 * 
 * Use this in client components and browser-side code
 */
export const createSupabaseClient = (): SupabaseClient => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.supabaseUrl;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.supabaseAnonKey;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return createClient(supabaseUrl, supabaseKey);
};

/**
 * Server-side Supabase client (uses service role key)
 * Use this in server components, API routes, and server actions
 * WARNING: This has admin privileges - use with caution!
 */
export const createSupabaseServerClient = (): SupabaseClient => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.supabaseUrl;
  const supabaseServiceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || env.supabaseServiceRoleKey;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

// Re-export types for convenience
export type { SupabaseClient } from '@supabase/supabase-js';

// Re-export database types
export * from './types';

