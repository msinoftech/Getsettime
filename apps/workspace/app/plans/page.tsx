"use client";

import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import type { booking_limit_period, plans_with_content } from "@app/db/subscription";
import {
  formatBookingLimitFeature,
  formatBookingLimitLabel,
  formatBookingUsageLabel,
  isUnlimitedBookingLimit,
  resolvePlanFeatures,
} from "@app/db/subscription";
import { useSubscription } from "@/src/hooks/useSubscription";
import { toast } from "@/src/components/ui/toast";

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  date: string;
  status: "paid" | "pending" | "overdue";
  plan: string;
}

interface AvailablePlan {
  id: string;
  slug: string;
  name: string;
  price: number;
  booking_limit: number;
  booking_limit_period: booking_limit_period;
  service_provider_limit: number;
  admin_limit: number;
  features: string[];
  popular?: boolean;
}

export default function Billing({ dark = false }: { dark?: boolean }) {
  const { data: subscriptionData, loading: subscriptionLoading } = useSubscription();
  const currentPlan = subscriptionData?.plan ?? null;
  const usage = subscriptionData?.usage ?? null;
  const [availablePlans, setAvailablePlans] = useState<AvailablePlan[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [isChangingPlan, setIsChangingPlan] = useState(false);

  const isLoading = subscriptionLoading || catalogLoading;

  useEffect(() => {
    void fetchPlanCatalog();
  }, []);

  const fetchPlanCatalog = async () => {
    try {
      setCatalogLoading(true);
      const catalogRes = await fetch('/api/billing/plans');
      if (catalogRes.ok) {
        const catalog = await catalogRes.json();
        const rows = (catalog.plans || []) as plans_with_content[];
        setAvailablePlans(
          rows.map((row) => ({
            id: String(row.id),
            slug: row.slug,
            name: row.name,
            price: row.price,
            booking_limit: row.booking_limit,
            booking_limit_period: row.booking_limit_period,
            service_provider_limit: row.service_provider_limit,
            admin_limit: row.admin_limit,
            features: resolvePlanFeatures(row),
            popular: row.content?.is_highlighted ?? false,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching plan catalog:', error);
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleChangePlan = async (selectedPlan: AvailablePlan) => {
    if (!currentPlan || selectedPlan.slug === currentPlan.slug) {
      setShowPlanModal(false);
      return;
    }

    if (selectedPlan.slug !== 'free') {
      toast.error('Paid plans are coming soon. Contact support to upgrade your workspace.');
      setShowPlanModal(false);
      return;
    }

    setIsChangingPlan(true);
    toast.error('Downgrading online is not available yet. Contact support if you need to change plans.');
    setIsChangingPlan(false);
    setShowPlanModal(false);
  };
  const [invoices] = useState<Invoice[]>([
    {
      id: "1",
      invoiceNumber: "INV-001",
      amount: 1999,
      date: "2024-01-15",
      status: "paid",
      plan: "Pro",
    },
    {
      id: "2",
      invoiceNumber: "INV-002",
      amount: 2099,
      date: "2024-02-15",
      status: "paid",
      plan: "Pro",
    },
    {
      id: "3",
      invoiceNumber: "INV-003",
      amount: 2199,
      date: "2024-03-15",
      status: "pending",
      plan: "Pro",
    },
  ]);

  const downloadInvoice = (invoice: Invoice) => {
    // Create a new PDF document
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let yPosition = margin;

    // Colors
    const primaryColor = [79, 70, 229]; // Indigo
    const textColor = [30, 41, 59]; // Slate 800
    const subTextColor = [100, 116, 139]; // Slate 500
    const borderColor = [226, 232, 240]; // Slate 200

    // Helper function to add text with word wrap
    const addText = (text: string, x: number, y: number, options: any = {}) => {
      const {
        fontSize = 10,
        color = textColor,
        align = "left",
        maxWidth = contentWidth,
      } = options;

      doc.setFontSize(fontSize);
      doc.setTextColor(color[0], color[1], color[2]);
      
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, y, { align });
      return lines.length * (fontSize * 0.35); // Return height used
    };

    // Helper function to draw a line
    const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.setLineWidth(0.5);
      doc.line(x1, y1, x2, y2);
    };

    // Header Section
    doc.setFontSize(24);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text("GetSetTime", margin, yPosition);
    
    yPosition += 5;
    doc.setFontSize(10);
    doc.setTextColor(subTextColor[0], subTextColor[1], subTextColor[2]);
    doc.setFont("helvetica", "normal");
    doc.text("Scheduling Made Simple", margin, yPosition);

    // Invoice Title (Right aligned)
    doc.setFontSize(20);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFont("helvetica", "bold");
    const invoiceTitle = "INVOICE";
    const invoiceTitleWidth = doc.getTextWidth(invoiceTitle);
    doc.text(invoiceTitle, pageWidth - margin - invoiceTitleWidth, margin);

    yPosition = margin + 8;
    doc.setFontSize(10);
    doc.setTextColor(subTextColor[0], subTextColor[1], subTextColor[2]);
    doc.setFont("helvetica", "normal");
    const invoiceNumberText = `Invoice #: ${invoice.invoiceNumber}`;
    const invoiceNumberWidth = doc.getTextWidth(invoiceNumberText);
    doc.text(invoiceNumberText, pageWidth - margin - invoiceNumberWidth, yPosition);

    yPosition += 5;
    const invoiceDate = new Date(invoice.date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const dateText = `Date: ${invoiceDate}`;
    const dateTextWidth = doc.getTextWidth(dateText);
    doc.text(dateText, pageWidth - margin - dateTextWidth, yPosition);

    yPosition += 5;
    const statusText = `Status: ${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}`;
    const statusTextWidth = doc.getTextWidth(statusText);
    doc.text(statusText, pageWidth - margin - statusTextWidth, yPosition);

    // Draw header separator line
    yPosition = margin + 25;
    drawLine(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;

    // Details Section
    doc.setFontSize(10);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text("Plan:", margin, yPosition);
    doc.setFont("helvetica", "normal");
    doc.text(`${invoice.plan} Plan`, margin + 30, yPosition);
    yPosition += 7;

    doc.setFont("helvetica", "bold");
    doc.text("Billing Period:", margin, yPosition);
    doc.setFont("helvetica", "normal");
    const billingPeriod = new Date(invoice.date).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    doc.text(billingPeriod, margin + 30, yPosition);
    yPosition += 7;

    doc.setFont("helvetica", "bold");
    doc.text("Payment Method:", margin, yPosition);
    doc.setFont("helvetica", "normal");
    doc.text("Credit Card", margin + 30, yPosition);
    yPosition += 15;

    // Items Table Header
    drawLine(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text("Description", margin + 2, yPosition);
    
    const amountText = "Amount";
    const amountTextWidth = doc.getTextWidth(amountText);
    doc.text(amountText, pageWidth - margin - amountTextWidth - 2, yPosition);

    yPosition += 5;
    drawLine(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    // Table Row
    doc.setFont("helvetica", "normal");
    doc.text(`${invoice.plan} Plan Subscription`, margin + 2, yPosition);
    
    const amount = `₹${invoice.amount.toLocaleString("en-IN")}`;
    const amountWidth = doc.getTextWidth(amount);
    doc.text(amount, pageWidth - margin - amountWidth - 2, yPosition);

    yPosition += 5;
    drawLine(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;

    // Totals Section
    const totalsStartX = pageWidth - margin - 80;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(subTextColor[0], subTextColor[1], subTextColor[2]);
    
    const subtotalLabel = "Subtotal:";
    const subtotalLabelWidth = doc.getTextWidth(subtotalLabel);
    doc.text(subtotalLabel, totalsStartX - subtotalLabelWidth, yPosition);
    doc.text(amount, pageWidth - margin - 2, yPosition);
    yPosition += 7;

    doc.text("Tax (GST):", totalsStartX - subtotalLabelWidth, yPosition);
    doc.text("₹0.00", pageWidth - margin - 2, yPosition);
    yPosition += 5;

    // Grand Total
    drawLine(totalsStartX - 10, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("Total:", totalsStartX - subtotalLabelWidth, yPosition);
    doc.text(amount, pageWidth - margin - 2, yPosition);

    // Footer
    yPosition = pageHeight - margin - 20;
    drawLine(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(subTextColor[0], subTextColor[1], subTextColor[2]);
    const footerText = "Thank you for your business!";
    const footerTextWidth = doc.getTextWidth(footerText);
    doc.text(footerText, (pageWidth - footerTextWidth) / 2, yPosition);

    yPosition += 5;
    const supportText = "For any questions, please contact support@getsettime.com";
    const supportTextWidth = doc.getTextWidth(supportText);
    doc.text(supportText, (pageWidth - supportTextWidth) / 2, yPosition);

    // Save the PDF
    doc.save(`${invoice.invoiceNumber}.pdf`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "overdue":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <section className="space-y-6 mr-auto">
      {/* Header */}
      <header className="flex flex-wrap justify-between relative gap-3">
        <div className="text-sm text-slate-500">
          <h3 className="text-xl font-semibold text-slate-800">Plans</h3>
          <p className="text-xs text-slate-500">Manage your subscription and view invoices.</p>
        </div>
      </header>

      {/* Current Plan Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden">
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-start gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-slate-800">Current Plan</h4>
                  {currentPlan ? (
                    <>
                      <p className="text-sm text-slate-500">
                        {currentPlan.name} • {formatBookingLimitFeature(currentPlan.booking_limit, currentPlan.booking_limit_period)} • up to{" "}
                        {currentPlan.service_provider_limit} providers
                      </p>
                      <p className="text-sm font-semibold text-slate-800 mt-1">
                      Enjoy a free trial period. After the trial ends, a subscription fee of ₹{currentPlan.price.toLocaleString("en-IN")}/month will apply.
                      </p>
                      {usage && (
                        <>
                          <p className="text-xs text-slate-500 mt-1">
                            {formatBookingUsageLabel(usage.booking_limit_period)}: {usage.bookings_used}
                            {isUnlimitedBookingLimit(usage.booking_limit)
                              ? " (unlimited plan)"
                              : ` / ${usage.booking_limit}`}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Usage: {usage.service_provider_count} / {usage.service_provider_limit} service providers
                          </p>
                        </>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">Loading plan…</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
