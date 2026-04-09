export type EventType = {
  id: string;
  title: string;
  duration_minutes?: number | null;
};

export type Department = {
  id: string;
  name: string;
};

export type ServiceProvider = {
  id: string;
  email: string;
  raw_user_meta_data?: {
    full_name?: string;
    name?: string;
    phone?: string;
  };
};

export type Service = {
  id: string;
  name: string;
  department_id?: number | string | null;
  departments?: { name: string } | null;
};

export type { IntakeFormSettings } from './workspace';
