"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pagination } from "@app/ui";
import {
  PUBLIC_FORM_TYPES,
  type public_form_submission_row,
  type public_form_type,
} from "@app/db/public_form_submissions";
import { FormSubmissionTableSkeleton } from "@/src/components/FormSubmissions/FormSubmissionTableSkeleton";

const ITEMS_PER_PAGE = 25;
const SEARCH_DEBOUNCE_MS = 350;

const FORM_TYPE_LABELS: Record<public_form_type, string> = {
  contact: "Contact",
  solutions: "Solutions",
  claim_free: "Claim free",
};

function format_ts(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function truncate(text: string | null, max = 48) {
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function humanizeKey(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function MetadataPanel({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata).filter(([, v]) => v != null && v !== "");
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">No additional fields.</p>;
  }
  return (
    <dl className="space-y-3">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {humanizeKey(key)}
          </dt>
          <dd className="mt-1 text-sm text-slate-800 whitespace-pre-wrap break-words">
            {typeof value === "string" ? value : JSON.stringify(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function FormSubmissionsPage() {
  const [submissions, setSubmissions] = useState<public_form_submission_row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [formTypeFilter, setFormTypeFilter] = useState<"" | public_form_type>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<public_form_submission_row | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchQ(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [formTypeFilter]);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(ITEMS_PER_PAGE));
      if (searchQ) params.set("q", searchQ);
      if (formTypeFilter) params.set("form_type", formTypeFilter);
      const res = await fetch(`/api/public-form-submissions?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load submissions");
      setSubmissions(data.submissions || []);
      setTotal(typeof data.total === "number" ? data.total : 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setSubmissions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, searchQ, formTypeFilter]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)),
    [total]
  );

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Form submissions</h1>
          <p className="text-xs text-slate-500 mt-1">
            Public marketing forms ({`POST /api/public/submit-forms`}).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            value={formTypeFilter}
            onChange={(e) => setFormTypeFilter(e.target.value as "" | public_form_type)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">All form types</option>
            {PUBLIC_FORM_TYPES.map((t) => (
              <option key={t} value={t}>
                {FORM_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <div className="flex-1 sm:min-w-[280px]">
            <label htmlFor="form-submission-search" className="sr-only">
              Search submissions
            </label>
            <input
              id="form-submission-search"
              type="search"
              autoComplete="off"
              placeholder="Search name, email, phone, message, metadata…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-white shadow-md overflow-hidden">
        {loading ? (
          <FormSubmissionTableSkeleton />
        ) : submissions.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-lg mb-2">No submissions found</p>
            {(searchQ || formTypeFilter) && (
              <p className="text-sm">Try clearing filters or search text.</p>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="border border-slate-200">
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                      Form
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                      Message
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                      Submitted
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-700 tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {submissions.map((row) => (
                    <tr
                      key={row.id}
                      className="bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-slate-800">
                        {FORM_TYPE_LABELS[row.form_type]}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-800">{row.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-800">{row.email}</td>
                      <td className="px-6 py-4 text-sm text-slate-800">{row.phone}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 max-w-xs">
                        {truncate(row.message)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">
                        {format_ts(row.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setDetailRow(row)}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
                        >
                          View more
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-200 px-4 pb-4">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={(p) => {
                  setPage(p);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                loading={loading}
                itemLabel="submissions"
              />
            </div>
          </>
        )}
      </div>

      {detailRow && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => setDetailRow(null)}
          role="presentation"
        >
          <div
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="form-submission-detail-title"
          >
            <button
              type="button"
              className="absolute right-4 top-4 text-2xl text-slate-400 hover:text-slate-600"
              aria-label="Close"
              onClick={() => setDetailRow(null)}
            >
              ×
            </button>
            <h2 id="form-submission-detail-title" className="text-lg font-semibold text-slate-800 pr-8">
              {FORM_TYPE_LABELS[detailRow.form_type]} submission
            </h2>
            <p className="text-xs text-slate-500 mt-1">{format_ts(detailRow.created_at)}</p>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-medium">Name:</span> {detailRow.name}
              </p>
              <p>
                <span className="font-medium">Email:</span> {detailRow.email}
              </p>
              <p>
                <span className="font-medium">Phone:</span> {detailRow.phone}
              </p>
              {detailRow.message && (
                <p>
                  <span className="font-medium">Message:</span>{" "}
                  <span className="whitespace-pre-wrap">{detailRow.message}</span>
                </p>
              )}
              {detailRow.source && (
                <p>
                  <span className="font-medium">Source:</span> {detailRow.source}
                </p>
              )}
            </div>
            <div className="mt-6 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Additional fields</h3>
              <MetadataPanel metadata={detailRow.metadata} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}