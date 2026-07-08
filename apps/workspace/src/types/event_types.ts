export type event_type_status = 'active' | 'draft';

export type event_types = {
  id: number;
  workspace_id: number;
  owner_id: string | null;
  title: string;
  slug: string | null;
  duration_minutes: number | null;
  buffer_before: number | null;
  buffer_after: number | null;
  location_type: string | null;
  location_value: string | null;
  is_public: boolean | null;
  status: event_type_status;
  settings: Record<string, unknown> | null;
  created_at: string;
};
