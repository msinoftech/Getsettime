'use client';
import { createSupabaseClient } from '@app/db';

// Client-side Supabase client (uses anon key)
// Note: Service role key should NEVER be used in client-side code for security reasons.
// Use supabaseServer in API routes for admin operations.
export const supabase = createSupabaseClient();

