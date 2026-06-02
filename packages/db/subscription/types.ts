export type subscription_status = 'active' | 'cancelled' | 'expired' | 'trial';

export type plans = {
  id: number;
  name: string;
  slug: string;
  price: number;
  booking_limit: number;
  workspace_limit: number;
  admin_limit: number;
  service_provider_limit: number;
  google_calendar_sync: boolean;
  email_notifications: boolean;
  public_booking_page: boolean;
  whatsapp_automation: boolean;
  online_payments: boolean;
  additional_locations: boolean;
  is_active: boolean;
  billing_interval: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type workspace_subscriptions = {
  id: number;
  workspace_id: number;
  plan_id: number;
  status: subscription_status;
  started_at: string;
  expires_at: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type plan_feature_key =
  | 'whatsapp_automation'
  | 'online_payments'
  | 'additional_locations'
  | 'google_calendar_sync'
  | 'email_notifications'
  | 'public_booking_page';

export type plan_check_result = {
  allowed: boolean;
  plan: string;
  upgradeRequired: boolean;
};

export type workspace_plan_snapshot = {
  plan: plans;
  subscription: workspace_subscriptions;
};

export type workspace_usage = {
  bookings_this_month: number;
  booking_limit: number;
  booking_percent_used: number;
  service_provider_count: number;
  service_provider_limit: number;
  location_count: number;
  booking_warning_threshold: boolean;
  booking_limit_reached: boolean;
};

export type PlanLimitErrorCode = 'PLAN_LIMIT' | 'FEATURE_GATED';
