export interface Service {
  id: string;
  workspace_id: number;
  name: string;
  description: string | null;
  price: number | null;
  created_at: string;
  updated_at: string;
}

export interface IntakeFormSettings {
  name?: boolean;
  email?: boolean;
  phone?: boolean;
  services?: {
    enabled: boolean;
    allowed_service_ids: string[];
  };
  additional_description?: boolean;
}

