"use client";

import { useEffect, useMemo, useState } from "react";
import type { plans_with_content } from "@app/db/subscription";
import {
  buildServiceProviderAddonRequest,
  calculatePlanPricingWithTax,
  isUnlimitedBookingLimit,
  resolvePlanFeatures,
} from "@app/db/subscription";
import { PlanPricingBreakdown } from "./PlanPricingBreakdown";

type payment_method = "Razorpay" | "Stripe";

interface DashboardUpgradeModalProps {
  open: boolean;
  onClose: () => void;
  usedBookings?: number;
  bookingLimit?: number;
}

function format_inr(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

function ctaClassNameForVariant(variant: "primary" | "dark" | undefined): string {
  if (variant === "dark") return "bg-slate-950 hover:bg-black text-white";
  return "bg-indigo-600 hover:bg-indigo-700 text-white";
}

export function DashboardUpgradeModal({
  open,
  onClose,
  usedBookings = 0,
  bookingLimit = 250,
}: DashboardUpgradeModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [planOptions, setPlanOptions] = useState<plans_with_content[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<plans_with_content | null>(null);
  const [requestedProviderCount, setRequestedProviderCount] = useState(2);
  const [paymentMethod, setPaymentMethod] = useState<payment_method>("Razorpay");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const loadPlans = async () => {
      setPlansLoading(true);
      setPlansError(null);
      try {
        const res = await fetch("/api/billing/plans");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load plans");

        const rows = (data.plans || []) as plans_with_content[];
        const paid = rows.filter((row) => row.slug !== "free" && row.price > 0);

        if (!cancelled) {
          setPlanOptions(paid);
          setSelectedPlan(paid[0] ?? null);
          setRequestedProviderCount(paid[0]?.service_provider_limit ?? 2);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setPlansError(err instanceof Error ? err.message : "Failed to load plans");
          setPlanOptions([]);
          setSelectedPlan(null);
        }
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    };

    void loadPlans();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const pricing = useMemo(() => {
    if (!selectedPlan) return null;
    return calculatePlanPricingWithTax(selectedPlan, [
      buildServiceProviderAddonRequest(requestedProviderCount),
    ]);
  }, [selectedPlan, requestedProviderCount]);

  const includedProviderLimit = selectedPlan?.service_provider_limit ?? 1;
  const minProviderCount = includedProviderLimit;

  const remainingBookings = isUnlimitedBookingLimit(bookingLimit)
    ? null
    : Math.max(0, bookingLimit - usedBookings);

  const handleClose = () => {
    setStep(1);
    const first = planOptions[0] ?? null;
    setSelectedPlan(first);
    setRequestedProviderCount(first?.service_provider_limit ?? 2);
    setPaymentMethod("Razorpay");
    setIsProcessing(false);
    onClose();
  };

  const handlePlanSelect = (plan: plans_with_content) => {
    setSelectedPlan(plan);
    setRequestedProviderCount(plan.service_provider_limit);
    setStep(2);
  };

  const handlePayment = () => {
    setIsProcessing(true);
    window.setTimeout(() => {
      setIsProcessing(false);
      setStep(4);
    }, 800);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-950/60 p-3 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dashboard-upgrade-title"
      onClick={handleClose}
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          className="relative max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-[34px] bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-slate-200 bg-white p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-600">
                  GetSetTime Billing
                </p>
                <h2 id="dashboard-upgrade-title" className="mt-2 text-2xl font-black md:text-3xl">
                  Upgrade your workspace
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Choose plan, providers, invoice, and secure payment.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-xl font-black text-slate-700"
                aria-label="Close upgrade modal"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-4">
              {[
                "1. Select Plan",
                "2. Providers & Billing",
                "3. Payment",
                "4. Activated",
              ].map((label, index) => {
                const isActive = index + 1 <= step;
                return (
                  <div
                    key={label}
                    className={`rounded-2xl px-3 py-3 text-center text-xs font-black ${
                      isActive ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="max-h-[72vh] overflow-y-auto bg-slate-50 p-4 md:p-6">
            {step === 1 && (
              <>
                <div className="mb-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                  <h3 className="font-black text-emerald-900">Your Free Plan is active</h3>
                  <p className="text-sm font-semibold text-emerald-700">
                    {isUnlimitedBookingLimit(bookingLimit) ? (
                      <>
                        {usedBookings} bookings used this month on your free plan. Upgrade for
                        automation, payments, analytics, and scaling.
                      </>
                    ) : (
                      <>
                        {usedBookings} of {bookingLimit} free bookings used. {remainingBookings}{" "}
                        bookings remaining. Upgrade for automation, payments, analytics, and scaling.
                      </>
                    )}
                  </p>
                </div>

                {plansLoading && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500">
                    Loading plans…
                  </div>
                )}

                {plansError && (
                  <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                    {plansError}
                  </div>
                )}

                {!plansLoading && !plansError && planOptions.length === 0 && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500">
                    No upgrade plans are available right now. Contact support@getsettime.com.
                  </div>
                )}

                <div className="grid gap-5 lg:grid-cols-2">
                  {planOptions.map((plan) => {
                    const content = plan.content;
                    const highlighted = content?.is_highlighted ?? false;
                    const features = resolvePlanFeatures(plan);
                    const seatPrice = plan.extra_service_provider_seat_price;

                    return (
                      <div
                        key={plan.id}
                        className={`relative rounded-[28px] bg-white p-6 ${
                          highlighted
                            ? "overflow-hidden border-2 border-indigo-500 shadow-xl shadow-indigo-100"
                            : "border border-slate-200 shadow-sm"
                        }`}
                      >
                        {highlighted && content?.badge_label && (
                          <div className="absolute right-0 top-0 rounded-bl-3xl bg-indigo-600 px-5 py-2 text-xs font-black text-white">
                            {content.badge_label}
                          </div>
                        )}
                        <h3 className="text-2xl font-black">{plan.name}</h3>
                        {content?.subtitle && (
                          <p className="mt-1 text-sm font-bold text-slate-500">{content.subtitle}</p>
                        )}
                        <p className="mt-6 text-4xl font-black">
                          {format_inr(plan.price)}{" "}
                          <span className="text-sm font-bold text-slate-500">/ month + GST</span>
                        </p>
                        <p className="mt-2 text-xs font-bold text-slate-500">
                          {plan.service_provider_limit} providers included
                          {seatPrice > 0
                            ? ` · +${format_inr(seatPrice)}/mo per extra provider`
                            : ""}
                        </p>

                        <div className="mt-6 grid gap-3 text-sm font-bold text-slate-700 sm:grid-cols-2">
                          {features.map((feature) => (
                            <p key={feature}>
                              {"\u2713"} {feature}
                            </p>
                          ))}
                        </div>

                        <button
                          type="button"
                          // onClick={() => handlePlanSelect(plan)}
                          className={`mt-8 h-12 w-full rounded-2xl font-black transition ${ctaClassNameForVariant(content?.cta_variant)}`}
                        >
                          {/* {content?.cta_label ?? `Continue with ${plan.name}`} */}
                          Coming Soon
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {step === 2 && selectedPlan && pricing && (
              <div className="grid gap-5 lg:grid-cols-[1fr_390px]">
                <div className="space-y-5">
                  <div className="rounded-[28px] border border-slate-200 bg-white p-6">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="mb-5 text-sm font-black text-indigo-600"
                    >
                      {"\u2190"} Back
                    </button>
                    <h3 className="text-3xl font-black">{selectedPlan.name} Plan</h3>
                    <p className="mt-2 text-sm font-bold text-slate-500">
                      {includedProviderLimit} providers included. Add more as needed.
                    </p>

                    <div className="mt-7 rounded-3xl bg-slate-50 p-6">
                      <div className="flex items-center justify-between gap-4">
                        <button
                          type="button"
                          onClick={() =>
                            setRequestedProviderCount((prev) =>
                              Math.max(minProviderCount, prev - 1)
                            )
                          }
                          disabled={requestedProviderCount <= minProviderCount}
                          className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-2xl font-black shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          −
                        </button>
                        <div className="text-center">
                          <p className="text-5xl font-black">{requestedProviderCount}</p>
                          <p className="mt-1 text-sm font-black text-slate-400">
                            Service providers
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRequestedProviderCount((prev) => prev + 1)}
                          className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-2xl font-black shadow-sm"
                        >
                          +
                        </button>
                      </div>
                      {requestedProviderCount > includedProviderLimit &&
                        selectedPlan.extra_service_provider_seat_price > 0 && (
                          <p className="mt-4 text-center text-xs font-bold text-indigo-600">
                            +{requestedProviderCount - includedProviderLimit} extra seat
                            {requestedProviderCount - includedProviderLimit === 1 ? "" : "s"} at{" "}
                            {format_inr(selectedPlan.extra_service_provider_seat_price)}/month each
                          </p>
                        )}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-white p-6">
                    <h4 className="text-xl font-black">Billing Information</h4>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <input
                        className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-bold"
                        defaultValue="Workspace owner"
                      />
                      <input
                        className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-bold"
                        defaultValue="India"
                      />
                      <input
                        className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-bold"
                        defaultValue="GetSetTime Workspace"
                      />
                      <input
                        className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-bold"
                        placeholder="GST Number optional"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <h4 className="text-xl font-black">Invoice Preview</h4>
                  <div className="mt-5">
                    <PlanPricingBreakdown
                      breakdown={pricing}
                      tax_amount={pricing.tax_amount}
                      total={pricing.total}
                      billing_interval={selectedPlan.billing_interval}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="mt-6 h-12 w-full rounded-2xl bg-indigo-600 font-black text-white transition hover:bg-indigo-700"
                  >
                    Continue to Payment
                  </button>
                </div>
              </div>
            )}

            {step === 3 && selectedPlan && pricing && (
              <div className="grid gap-5 lg:grid-cols-[1fr_390px]">
                <div className="rounded-[28px] border border-slate-200 bg-white p-6">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="mb-5 text-sm font-black text-indigo-600"
                  >
                    {"\u2190"} Back
                  </button>
                  <h3 className="text-3xl font-black">Secure Payment</h3>
                  <p className="mt-2 text-sm font-bold text-slate-500">Choose payment method.</p>

                  <div className="mt-6 grid gap-4">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("Razorpay")}
                      className={`rounded-3xl p-5 text-left ${
                        paymentMethod === "Razorpay"
                          ? "border-2 border-indigo-600 bg-indigo-50 shadow-sm"
                          : "border border-slate-200 bg-white"
                      }`}
                    >
                      <h4 className="text-xl font-black">Razorpay</h4>
                      <p className="mt-1 text-sm font-bold text-slate-500">
                        UPI, cards, net banking, wallets.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("Stripe")}
                      className={`rounded-3xl p-5 text-left ${
                        paymentMethod === "Stripe"
                          ? "border-2 border-indigo-600 bg-indigo-50 shadow-sm"
                          : "border border-slate-200 bg-white"
                      }`}
                    >
                      <h4 className="text-xl font-black">Stripe</h4>
                      <p className="mt-1 text-sm font-bold text-slate-500">
                        International cards and global payments.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <h4 className="text-xl font-black">Payment Summary</h4>
                  <div className="mt-5">
                    <PlanPricingBreakdown
                      breakdown={pricing}
                      tax_amount={pricing.tax_amount}
                      total={pricing.total}
                      billing_interval={selectedPlan.billing_interval}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handlePayment}
                    disabled={isProcessing}
                    className={`mt-6 h-12 w-full rounded-2xl font-black text-white transition ${
                      isProcessing
                        ? "cursor-not-allowed bg-indigo-400"
                        : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                  >
                    {isProcessing
                      ? "Processing secure payment..."
                      : `Pay ${format_inr(Number(pricing.total.toFixed(2)))} with ${paymentMethod}`}
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="grid min-h-[520px] place-items-center text-center">
                <div className="max-w-md">
                  <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-emerald-100 text-5xl text-emerald-600">
                    {"\u2713"}
                  </div>
                  <h3 className="mt-6 text-4xl font-black">Payment Successful</h3>
                  <p className="mt-3 text-sm font-bold text-slate-500">
                    Your workspace has been upgraded and premium features are active.
                  </p>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="mt-7 h-12 rounded-2xl bg-indigo-600 px-8 font-black text-white transition hover:bg-indigo-700"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white px-6 py-4">
            <div className="flex flex-col gap-2 text-xs font-bold text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <span>Secure billing · GST invoice · Cancel anytime</span>
              <span>Need help? Contact support@getsettime.com</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
