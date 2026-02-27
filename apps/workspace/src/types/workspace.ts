export type DayName = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export type BreakTime = {
  id: string;
  start: string;
  end: string;
};

export type DaySchedule = {
  enabled: boolean;
  startTime: string;
  endTime: string;
  breaks: BreakTime[];
};

export type AvailabilityGrid = {
  enabled?: Record<DayName, boolean>;
  timeSlots?: Record<string, boolean>;
  lastUpdated?: string;
};

export type AvailabilitySettings = {
  grid?: AvailabilityGrid;
  individual?: Record<string, boolean>;
  timesheet?: Record<DayName, DaySchedule> | null;
};

export type GeneralSettings = {
  accountName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  /** IANA timezone (e.g. Asia/Kolkata) for booking display; fallback to browser if unset */
  timezone?: string | null;
};

export type IntakeFormServiceSettings = {
  enabled?: boolean;
  allowed_service_ids?: string[];
};

export type IntakeCustomFieldOption =
  | string
  | {
      label: string;
      value: string;
    };

export type IntakeCustomFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'tel'
  | 'url'
  | 'date'
  | 'select';

export type IntakeCustomField = {
  id: string;
  label: string;
  /**
   * Supports both legacy `field_type` (current RoutingForm UI) and `type` (requested spec).
   */
  field_type?: IntakeCustomFieldType;
  type?: IntakeCustomFieldType;
  required?: boolean;
  placeholder?: string;
  options?: IntakeCustomFieldOption[];
};

export type IntakeFormSettings = {
  name?: boolean;
  email?: boolean;
  phone?: boolean;
  /**
   * Supports both boolean and object shapes.
   * - boolean (requested spec)
   * - { enabled, allowed_service_ids } (current RoutingForm UI)
   */
  services?: boolean | IntakeFormServiceSettings;
  additional_description?: boolean;
  custom_fields?: IntakeCustomField[];
};

export type WorkspaceSettings = {
  general?: GeneralSettings;
  availability?: AvailabilitySettings;
  intake_form?: IntakeFormSettings;
};

export type WorkspaceSettingsHook = {
  settings: WorkspaceSettings;
  general: GeneralSettings;
  availability: AvailabilitySettings;
  workspaceName?: string | null;
  workspaceLogo?: string | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

