'use client';
import { createSupabaseClient } from '@app/db';

// Client-side Supabase client (uses anon key)
export const supabase = createSupabaseClient();
