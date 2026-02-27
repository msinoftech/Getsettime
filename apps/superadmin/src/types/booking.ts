export type Booking = {
  id: string;
  workspace_id: string;
  event_type_id: string | null;
  host_user_id: string | null;
  invitee_name: string | null;
  invitee_email: string | null;
  invitee_phone: string | null;
  start_at: string | null;
  end_at: string | null;
  status: string | null;
  location: Record<string, unknown> | null;
  payment_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  event_types?: {
    title: string;
  } | null;
};

