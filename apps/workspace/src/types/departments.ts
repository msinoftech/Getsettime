/** `public.departments` row (values from API / Supabase). */
export type departments = {
  id: number;
  workspace_id: number;
  name: string;
  description: string | null;
  status: string;
  flag: boolean;
  meta_data: Record<string, unknown> | null;
  created_at: string;
};
