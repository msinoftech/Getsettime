"use client";

import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  date: string;
  status: "paid" | "pending" | "overdue";
  plan: string;
}

interface Plan {
  name: string;
  seats: number;
  limits: string;
  price?: number;
}

interface AvailablePlan {
  id: string;
  name: string;
  seats: number;
  limits: string;
  price: number;
  features: string[];
  popular?: boolean;
}

export default function Billing({ dark = false, plan = { name: "Pro", seats: 5, limits: "Unlimited meetings", price: 1999 } }: { dark?: boolean; plan?: Plan }) {
  const [currentPlan, setCurrentPlan] = useState<Plan>(plan);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const availablePlans: AvailablePlan[] = [
    {
      id: "free",
      name: "Free",
      seats: 1,
      limits: "10 meetings/month",
      price: 0,
      features: [
        "1 team member",
        "10 meetings per month",
        "Basic scheduling",
        "Email support",
      ],
    },
    {
      id: "starter",
      name: "Starter",
      seats: 3,
      limits: "50 meetings/month",
      price: 999,
      features: [
        "3 team members",
        "50 meetings per month",
        "Advanced scheduling",
        "Calendar integrations",
        "Email support",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      seats: 5,
      limits: "Unlimited meetings",
      price: 1999,
      popular: true,
      features: [
        "5 team members",
        "Unlimited meetings",
        "Advanced scheduling",
        "All integrations",
        "Priority support",
        "Custom branding",
      ],
    },
    {
      id: "enterprise",
      name: "Enterprise",
      seats: 20,
      limits: "Unlimited meetings",
      price: 4999,
      features: [
        "20+ team members",
        "Unlimited meetings",
        "Advanced scheduling",
        "All integrations",
        "Dedicated support",
        "Custom branding",
        "API access",
        "Custom integrations",
      ],
    },
  ];

  useEffect(() => {
    fetchCurrentPlan();
  }, []);

  const fetchCurrentPlan = async () => {
    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/billing/plan', {
        headers: token ? {
          'Authorization': `Bearer ${token}`,
        } : {},
      });

      if (response.ok) {
        const data = await response.json();
        if (data.plan) {
          setCurrentPlan(data.plan);
        }
      }
    } catch (error) {
      console.error('Error fetching plan:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePlan = async (selectedPlan: AvailablePlan) => {
    if (selectedPlan.name === currentPlan.name) {
      setShowPlanModal(false);
      return;
    }

    setIsChangingPlan(true);
    setMessage(null);

    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/billing/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          plan: {
            name: selectedPlan.name,
            seats: selectedPlan.seats,
            limits: selectedPlan.limits,
            price: selectedPlan.price,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentPlan(data.plan);
        setMessage({ type: 'success', text: 'Plan changed successfully!' });
        setShowPlanModal(false);
        setTimeout(() => setMessage(null), 3000);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to change plan' });
      }
    } catch (error: any) {
      console.error('Error changing plan:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to change plan' });
    } finally {
      setIsChangingPlan(false);
    }
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
          <h3 className="text-xl font-semibold text-slate-800">Billing</h3>
          <p className="text-xs text-slate-500">Manage your subscription and view invoices.</p>
        </div>
      </header>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Current Plan Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden">
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-slate-800">Current Plan</h4>
                  <p className="text-sm text-slate-500">
                    {currentPlan.name} • {currentPlan.seats} seat{currentPlan.seats > 1 ? "s" : ""} • {currentPlan.limits}
                  </p>
                  {currentPlan.price !== undefined && (
                    <p className="text-sm font-semibold text-slate-800 mt-1">
                      ₹{currentPlan.price.toLocaleString("en-IN")}/month
                    </p>
                  )}
                </div>
              </div>
            </div>
            <button 
              onClick={() => setShowPlanModal(true)}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-sm hover:shadow-md"
            >
              Change Plan
            </button>
          </div>
        </div>
      </div>

      {/* Plan Selection Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !isChangingPlan && setShowPlanModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold text-slate-800">Choose Your Plan</h3>
                <button
                  onClick={() => setShowPlanModal(false)}
                  disabled={isChangingPlan}
                  className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-slate-500 mt-2">Select a plan that best fits your needs</p>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {availablePlans.map((planOption) => {
                  const isCurrentPlan = planOption.name === currentPlan.name;
                  const isPopular = planOption.popular;

                  return (
                    <div
                      key={planOption.id}
                      className={`relative rounded-xl border-2 p-6 transition-all ${
                        isCurrentPlan
                          ? 'border-indigo-500 bg-indigo-50'
                          : isPopular
                          ? 'border-indigo-300 bg-white hover:border-indigo-400 hover:shadow-lg'
                          : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md'
                      }`}
                    >
                      {isPopular && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                            Popular
                          </span>
                        </div>
                      )}

                      {isCurrentPlan && (
                        <div className="absolute -top-3 right-3">
                          <span className="bg-emerald-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                            Current
                          </span>
                        </div>
                      )}

                      <div className="mt-2">
                        <h4 className="text-xl font-bold text-slate-800">{planOption.name}</h4>
                        <div className="mt-4">
                          <span className="text-3xl font-bold text-slate-800">₹{planOption.price.toLocaleString("en-IN")}</span>
                          <span className="text-sm text-slate-500">/month</span>
                        </div>
                        <p className="text-sm text-slate-500 mt-2">
                          {planOption.seats} seat{planOption.seats > 1 ? "s" : ""} • {planOption.limits}
                        </p>
                      </div>

                      <ul className="mt-6 space-y-3">
                        {planOption.features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-sm text-slate-600">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() => handleChangePlan(planOption)}
                        disabled={isCurrentPlan || isChangingPlan}
                        className={`w-full mt-6 py-2.5 rounded-lg font-medium transition-colors ${
                          isCurrentPlan
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : isPopular
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        } disabled:opacity-50`}
                      >
                        {isCurrentPlan ? 'Current Plan' : isChangingPlan ? 'Changing...' : 'Select Plan'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoices Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-semibold text-slate-800">Invoice History</h4>
            <span className="text-sm text-slate-500">{invoices.length} invoices</span>
          </div>

          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-slate-500">No invoices found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex flex-wrap items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all bg-slate-50/50"
                >
                  <div className="flex-1 min-w-[200px] mb-3 sm:mb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">{invoice.invoiceNumber}</div>
                        <div className="text-sm text-slate-500">
                          {new Date(invoice.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-right">
                      <div className="font-semibold text-slate-800">₹{invoice.amount.toLocaleString("en-IN")}</div>
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(invoice.status)}`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </div>

                    <button
                      onClick={() => downloadInvoice(invoice)}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-white hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center gap-2 shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
