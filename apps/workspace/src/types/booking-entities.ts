export type EventType = {
  id: string;
  title: string;
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
  };
};

export type Service = {
  id: string;
  name: string;
};

export type { IntakeFormSettings } from './workspace';
