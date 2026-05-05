"use client";

import { useState } from "react";

type RequestIntegrationModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
};

export function RequestIntegrationModal({ open, onClose, onSubmitted }: RequestIntegrationModalProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setSubject("");
    setMessage("");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const s = subject.trim();
    const m = message.trim();
    if (!s || !m) {
      setError("Subject and message are required.");
      return;
    }
    setLoading(true);
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/integrations/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ subject: s, message: m }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Request failed.");
        return;
      }
      onSubmitted?.();
      handleClose();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-integration-title"
      >
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 id="request-integration-title" className="text-lg font-semibold text-slate-900">
            Request new integration
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Tell us what you need. Our team will review your request.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}
          <label className="block text-sm font-medium text-slate-700" htmlFor="integration-request-subject">
            Subject
          </label>
          <input
            id="integration-request-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={300}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            placeholder="e.g. WhatsApp reminders"
            disabled={loading}
          />
          <label
            className="mt-4 block text-sm font-medium text-slate-700"
            htmlFor="integration-request-message"
          >
            Message
          </label>
          <textarea
            id="integration-request-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={8000}
            rows={5}
            className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            placeholder="Describe the integration and how you plan to use it."
            disabled={loading}
          />
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Sending…" : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
