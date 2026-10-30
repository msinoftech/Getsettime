export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  // Storage bucket name for workspace logos
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || '',
  superadminApiUrl: process.env.NEXT_PUBLIC_SUPERADMIN_API_URL || '',
  enableDynamicBookingStepOrder:
    process.env.ENABLE_DYNAMIC_BOOKING_STEP_ORDER || '',
};

export function is_dynamic_booking_step_order_enabled(): boolean {
  const raw = (env.enableDynamicBookingStepOrder || '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}