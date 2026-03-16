/** Single source of truth for booking form constants */

// Colors
export const DEFAULT_PRIMARY_COLOR = '#9333EA';
export const DEFAULT_ACCENT_COLOR = '#3B82F6';
export const SUCCESS_CONFETTI_COLORS = ['#9333EA', '#3B82F6', '#10B981', '#F59E0B'] as const;

// Event types sort order (minutes): 15, 30, 45, then 60+
export const EVENT_TYPE_DURATION_SORT_ORDER = [15, 30, 45, 60] as const;

// Day names (Sun=0 from date.getDay())
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// UI copy - Step titles
export const BOOKING_STEP_TITLES = {
  step1: 'Select Department & Provider',
  step1Subtitle: "Choose the department and who you'd like to book with",
  step2: 'Choose a service',
  step2Subtitle: 'What would you like to book?',
  step3: 'Pick a date & time',
  step3Subtitle: 'Select when you\'d like to meet',
  step4: 'Your details',
  step4Subtitle: 'Tell us how to reach you ✨',
  step5: "You're all set! 🎉",
  step5Subtitle: 'See you soon 👋',
} as const;

// Placeholders
export const BOOKING_PLACEHOLDERS = {
  name: 'Enter your full name',
  email: 'your.email@example.com',
  phone: '+1 (555) 000-0000',
  notes: 'Anything we should know?',
  selectOption: 'Select an option',
} as const;

// Button labels
export const BOOKING_BUTTON_LABELS = {
  continueToServices: 'Continue to Services',
  back: 'Back',
  continue: 'Continue',
  confirmBooking: 'Confirm Booking',
  creating: 'Creating...',
  hideCalendar: 'Hide Calendar',
  showCalendar: 'Show Calendar',
  pickDay: 'Pick a day',
  availableTimes: 'Available times',
} as const;

// Loading states
export const BOOKING_LOADING_MESSAGES = {
  departments: 'Loading departments...',
  providers: 'Loading providers...',
  eventTypes: 'Loading event types...',
  availability: 'Loading available times...',
  services: 'Loading services…',
} as const;

// Empty states
export const BOOKING_EMPTY_MESSAGES = {
  noDepartments: 'No departments available',
  noProviders: 'No providers available for this department',
  noEventTypes: 'No event types available',
  noEventTypesHint: 'Please create an event type first',
  noSelection: 'No selection yet',
  noSelectionHintDept: 'Start by selecting a department',
  noSelectionHintService: 'Start by selecting a service',
  noTimeSlots: 'No available time slots for this date',
  selectEventFirst: 'Please select an event type first',
  selectDateFirst: 'Please select a date first',
  noServices: 'No services available',
} as const;

// Config
export const SCROLL_LOAD_DISTANCE = 200;
export const SUCCESS_REDIRECT_MS = 3700;
export const DAYS_BATCH_SIZE = 10;
export const CALENDAR_BUFFER_DAYS = 30;
export const CALENDAR_BUFFER_DAYS_BEFORE = 5;
export const DEFAULT_WORKSPACE_NAME = 'Get Set Time';

/** Service subtitles by duration (minutes) */
export const SERVICE_SUBTITLES: Record<string, string> = {
  short: 'Fast friendly catch-up',
  medium: 'Deep planning & growth discussion',
  long: 'Full problem-solving session',
};
