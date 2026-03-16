import type { IntakeFormSettings } from './workspace';

/** Day names matching date.getDay() order (Sun=0) */
export type DayName = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

export interface EventType {
  id: string;
  title: string;
  duration_minutes: number | null;
  slug?: string;
}

export interface Department {
  id: number;
  name: string;
  description: string | null;
}

export interface ServiceProvider {
  id: string;
  name: string;
  email: string;
  departments: number[];
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
}

export interface Timeslot {
  time: string;
  disabled: boolean;
  reason?: string;
}

export type IntakeValues = Record<string, string | string[]>;

export interface MultiStepBookingFormProps {
  onSave: () => void;
  onCancel: () => void;
}
