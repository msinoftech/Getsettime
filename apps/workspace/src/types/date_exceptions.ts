export type date_exception_category = 'holiday' | 'custom';

export type date_exception_availability_type =
  | 'closed'
  | 'unavailable'
  | 'special_hours';

export type date_exception_status = 'active' | 'inactive';

export type date_exception = {
  id: number;
  workspace_id: number;
  provider_id: string | null;
  name: string;
  exception_date: string;
  exception_category: date_exception_category;
  availability_type: date_exception_availability_type;
  start_time: string | null;
  end_time: string | null;
  repeat_yearly: boolean;
  notes: string | null;
  status: date_exception_status;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type date_exception_create_input = {
  name: string;
  exception_date: string;
  exception_category?: date_exception_category;
  availability_type: date_exception_availability_type;
  provider_id?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  repeat_yearly?: boolean;
  notes?: string | null;
  status?: date_exception_status;
};

export type date_exception_update_input = Partial<date_exception_create_input>;
