import { createSupabaseServerClient } from '@app/db';

// Server-side Supabase client (uses service role key)
// Initialize with error handling
let _supabaseServer: ReturnType<typeof createSupabaseServerClient> | null = null;

function getSupabaseServer() {
  if (!_supabaseServer) {
    try {
      _supabaseServer = createSupabaseServerClient();
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      throw new Error(
        `Failed to initialize Supabase server client: ${errorMessage}. ` +
        `Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY environment variables are set.`
      );
    }
  }
  return _supabaseServer;
}

// Export getter function
export { getSupabaseServer };

// Export for backward compatibility - lazy initialization
export const supabaseServer = {
  get auth() {
    return getSupabaseServer().auth;
  }
} as ReturnType<typeof createSupabaseServerClient>;
