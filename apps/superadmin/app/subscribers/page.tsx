"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pagination } from "@app/ui";
import type { public_subscriber_row } from "@app/db/public_subscribers";
import { SubscriberTableSkeleton } from "@/src/components/Subscribers/SubscriberTableSkeleton";

const ITEMS_PER_PAGE = 25;
const EMAIL_FILTER_DEBOUNCE_MS = 350;

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

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<public_subscriber_row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [emailInput, setEmailInput] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setEmailFilter(emailInput.trim());
      setPage(1);
    }, EMAIL_FILTER_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [emailInput]);

  const loadSubscribers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(ITEMS_PER_PAGE));
      if (emailFilter) params.set("email", emailFilter);
      const res = await fetch(`/api/public-subscribers?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load subscribers");
      setSubscribers(data.subscribers || []);
      setTotal(typeof data.total === "number" ? data.total : 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setSubscribers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, emailFilter]);

  useEffect(() => {
    void loadSubscribers();
  }, [loadSubscribers]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)),
    [total]
  );

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Public subscribers</h1>
          <p className="text-xs text-slate-500 mt-1">
            Emails collected from the marketing site ({`POST /api/public/subscribers`}).
          </p>
        </div>
        <div className="w-full sm:w-auto sm:min-w-[280px]">
          <label htmlFor="subscriber-email-filter" className="sr-only">
            Filter by email
          </label>
          <input
            id="subscriber-email-filter"
            type="search"
            autoComplete="off"
            placeholder="Filter by email…"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-white shadow-md overflow-hidden">
        {loading ? (
          <SubscriberTableSkeleton />
        ) : subscribers.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-lg mb-2">No subscribers found</p>
            {emailFilter ? (
              <p className="text-sm">Try a different email filter or clear the search box.</p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="border border-slate-200">
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                      Subscribed at
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {subscribers.map((row) => (
                    <tr
                      key={row.id}
                      className="bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-slate-800">{row.email}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{row.source || "—"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">
                        {format_ts(row.created_at)}
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
                itemLabel="subscribers"
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}