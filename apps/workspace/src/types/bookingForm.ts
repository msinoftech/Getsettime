import type { IntakeFormSettings } from './workspace';
import type { departments } from './departments';

/** Day names matching date.getDay() order (Sun=0) */
export type DayName = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

export interface EventType {
  id: string;
  title: string;
  duration_minutes: number | null;
  slug?: string;
  owner_id?: string | null;
  is_public?: boolean | null;
  /** Single type or comma-separated (e.g. `video,in_person`). */
  location_type?: string | null;
}

export type Department = Pick<
  departments,
  'id' | 'name' | 'description' | 'status'
>;

export interface ServiceProvider {
  id: string;
  name: string;
  email: string;
  departments: number[];
  education?: string | null;
  experience?: string | null;
  specialty?: string | null;
  admin_notice?: string | null;
  is_workspace_owner?: boolean;
  /** Matches auth metadata; used with userActsAsServiceProviderFromMetadata */
  additional_roles?: string[];
  role?: string | null;
}

export interface BreakTime {
  id: string;
  start: string;
  end: string;
}

export interface DaySchedule {
  enabled: boolean;
  startTime: string;
  endTime: string;
  breaks: BreakTime[];
}

export interface AvailabilitySettings {
  timesheet?: Record<DayName, DaySchedule>;
  individual?: Record<string, boolean>;
}

export interface Booking {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  duration?: number | null;
  department_id?: number | null;
  status?: string;
  meta_data?: Record<string, unknown> | null;
}

export interface Timeslot {
  /** Display label in customer/viewer timezone */
  time: string;
  /** Canonical UTC ISO instant for booking submission */
  startUtc: string;
  /** Optional host-local label when viewer TZ differs */
  hostTime?: string;
  disabled: boolean;
  reason?: string;
}

export type IntakeValues = Record<string, string | string[]>;

export interface MultiStepBookingFormProps {
  variant?: 'overlay' | 'embedded';
  /** When true, omits embedded Cancel chrome (e.g. shell modal provides Close). Default false. */
  hide_embedded_toolbar?: boolean;
  onSave: () => void;
  onCancel: () => void;
}
