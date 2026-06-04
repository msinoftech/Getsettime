import type { plans } from './types';

/** Extensible add-on keys for modular subscription pricing. */
export type plan_addon_key =
  | 'service_provider_seat'
  | 'admin_seat'
  | 'location'
  | 'whatsapp_automation'
  | 'sms_credits'
  | 'storage';

export type plan_addon_request = {
  key: plan_addon_key;
  requested_quantity: number;
};

export type plan_pricing_line_item = {
  key: plan_addon_key;
  label: string;
  included_quantity: number;
  requested_quantity: number;
  extra_quantity: number;
  unit_price: number;
  line_total: number;
};

export type plan_pricing_breakdown = {
  base_plan_price: number;
  line_items: plan_pricing_line_item[];
  subtotal: number;
};

const ADDON_LABELS: Record<plan_addon_key, string> = {
  service_provider_seat: 'Additional service provider seats',
  admin_seat: 'Additional admin seats',
  location: 'Additional locations',
  whatsapp_automation: 'WhatsApp automation',
  sms_credits: 'SMS credits',
  storage: 'Storage',
};

function getPlanIncludedQuantity(plan: plans, key: plan_addon_key): number {
  switch (key) {
    case 'service_provider_seat':
      return plan.service_provider_limit;
    case 'admin_seat':
      return plan.admin_limit;
    case 'location':
      return plan.additional_locations ? 1 : 0;
    default:
      return 0;
  }
}

function getPlanAddonUnitPrice(plan: plans, key: plan_addon_key): number {
  switch (key) {
    case 'service_provider_seat':
      return plan.extra_service_provider_seat_price;
    default:
      return 0;
  }
}

function isAddonEnabled(plan: plans, key: plan_addon_key): boolean {
  switch (key) {
    case 'service_provider_seat':
      return true;
    case 'admin_seat':
    case 'location':
    case 'whatsapp_automation':
    case 'sms_credits':
    case 'storage':
      return false;
    default:
      return false;
  }
}

export function buildPlanAddonLineItem(
  plan: plans,
  request: plan_addon_request
): plan_pricing_line_item {
  const included_quantity = getPlanIncludedQuantity(plan, request.key);
  const unit_price = getPlanAddonUnitPrice(plan, request.key);
  const requested_quantity = Math.max(0, Math.floor(request.requested_quantity));
  const extra_quantity = Math.max(0, requested_quantity - included_quantity);

  return {
    key: request.key,
    label: ADDON_LABELS[request.key],
    included_quantity,
    requested_quantity,
    extra_quantity,
    unit_price,
    line_total: extra_quantity * unit_price,
  };
}

/** Modular monthly subscription total before tax. */
export function calculatePlanPricing(
  plan: plans,
  addon_requests: plan_addon_request[]
): plan_pricing_breakdown {
  const line_items = addon_requests
    .filter((request) => isAddonEnabled(plan, request.key))
    .map((request) => buildPlanAddonLineItem(plan, request));

  const addon_total = line_items.reduce((sum, item) => sum + item.line_total, 0);

  return {
    base_plan_price: plan.price,
    line_items,
    subtotal: plan.price + addon_total,
  };
}

export function calculatePlanPricingWithTax(
  plan: plans,
  addon_requests: plan_addon_request[],
  tax_rate = 0.18
): plan_pricing_breakdown & { tax_amount: number; total: number } {
  const breakdown = calculatePlanPricing(plan, addon_requests);
  const tax_amount = breakdown.subtotal * tax_rate;
  return {
    ...breakdown,
    tax_amount,
    total: breakdown.subtotal + tax_amount,
  };
}

export function getServiceProviderSeatLineItem(
  breakdown: plan_pricing_breakdown
): plan_pricing_line_item | undefined {
  return breakdown.line_items.find((item) => item.key === 'service_provider_seat');
}

export function buildServiceProviderAddonRequest(
  requested_provider_limit: number
): plan_addon_request {
  return {
    key: 'service_provider_seat',
    requested_quantity: Math.max(0, Math.floor(requested_provider_limit)),
  };
}
