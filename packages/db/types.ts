// add generated types from supabase later (optional)
export type Workspace = {
  id: string;
  name: string;
  slug: string;
  primary_color?: string | null;
  accent_color?: string | null;
  logo_url?: string | null;
  billing_customer_id?: string | null;
  created_at: string;
};

export const BOOKING_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'reschedule', label: 'Reschedule' },
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number]['value'];

export const BOOKING_SORT_OPTIONS = [
  { value: 'start_at', label: 'Date / Time' },
  { value: 'latest', label: 'Latest' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'new', label: 'New' },
] as const;

export type BookingSortOption = (typeof BOOKING_SORT_OPTIONS)[number]['value'];
