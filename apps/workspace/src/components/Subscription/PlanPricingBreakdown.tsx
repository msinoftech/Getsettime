"use client";

import type { plan_pricing_breakdown } from "@app/db/subscription";
import { getServiceProviderSeatLineItem } from "@app/db/subscription";

function format_inr(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

type PlanPricingBreakdownProps = {
  breakdown: plan_pricing_breakdown;
  tax_amount: number;
  total: number;
  billing_interval?: string | null;
};

export function PlanPricingBreakdown({
  breakdown,
  tax_amount,
  total,
  billing_interval = "month",
}: PlanPricingBreakdownProps) {
  const seatLine = getServiceProviderSeatLineItem(breakdown);
  const intervalLabel = billing_interval?.trim() || "month";

  return (
    <div className="space-y-3 text-sm font-bold">
      <div className="rounded-2xl bg-slate-50 p-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-slate-500">Plan price</span>
          <span>
            {format_inr(breakdown.base_plan_price)}/{intervalLabel}
          </span>
        </div>
        {seatLine && (
          <>
            <div className="flex justify-between">
              <span className="text-slate-500">Included providers</span>
              <span>{seatLine.included_quantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Requested providers</span>
              <span>{seatLine.requested_quantity}</span>
            </div>
            {seatLine.extra_quantity > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">Additional seats</span>
                  <span>{seatLine.extra_quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Seat price</span>
                  <span>
                    {format_inr(seatLine.unit_price)}/{intervalLabel}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Extra seats subtotal</span>
                  <span>{format_inr(seatLine.line_total)}</span>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="flex justify-between">
        <span className="text-slate-500">Subtotal</span>
        <span>{format_inr(breakdown.subtotal)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-500">GST 18%</span>
        <span>{format_inr(Number(tax_amount.toFixed(2)))}</span>
      </div>
      <div className="flex justify-between border-t border-slate-200 pt-4 text-xl font-black">
        <span>Total</span>
        <span>{format_inr(Number(total.toFixed(2)))}</span>
      </div>
    </div>
  );
}
