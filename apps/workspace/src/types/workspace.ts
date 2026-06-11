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
  tagline?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  /** IANA timezone (e.g. Asia/Kolkata) for booking display; fallback to browser if unset */
  timezone?: string | null;
  business_email?: string | null;
  business_phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  country?: string | null;
};

/** ipapi.co/json snapshot saved once at workspace registration. */
export type localization_settings = Record<string, unknown> & {
  fetched_at?: string;
  error?: string;
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
  file_upload?: boolean;
  services?: boolean | IntakeFormServiceSettings;
  additional_description?: boolean;
  custom_fields?: IntakeCustomField[];
};

export type meeting_options_settings = {
  google_meet?: boolean;
  in_person?: boolean;
  phone_call?: boolean;
  whatsapp?: boolean;
};

import type { workspace_notifications_settings } from '@/lib/workspace-notification-flags';

export type { workspace_notifications_settings };

export type WorkspaceSettings = {
  general?: GeneralSettings;
  availability?: AvailabilitySettings;
  intake_form?: IntakeFormSettings;
  meeting_options?: meeting_options_settings;
  notifications?: workspace_notifications_settings;
  /** Public booking link slugs keyed by service provider user id */
  links?: Record<string, { slug?: string }>;
  /** Write-once ipapi geo snapshot from workspace registration */
  localization?: localization_settings;
};

export type WorkspaceSettingsHook = {
  settings: WorkspaceSettings;
  general: GeneralSettings;
  availability: AvailabilitySettings;
  workspaceName?: string | null;
  workspaceLogo?: string | null;
  /** `workspaceLogo` / legacy `general.logoUrl` resolved with app fallback */
  workspaceLogoResolved: string;
  /** Resolved profession label from workspace (joined name or legacy `type`) */
  workspaceProfessionLabel?: string | null;
  /** Settings → My Link slug for public booking at `/{slug}` */
  workspaceSlug?: string | null;
  /** Logged-in service provider link slug at `/{workspaceSlug}/{slug}` */
  serviceProviderLinkSlug?: string | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

