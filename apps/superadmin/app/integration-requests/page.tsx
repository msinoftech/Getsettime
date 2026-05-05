"use client";

import React, { useEffect, useMemo, useState } from "react";

const MARK_SEEN_EVENT = "integration-requests-marked-seen";

export type IntegrationRequestRow = {
  id: string;
  workspace_id: number;
  workspace_name: string;
  workspace_admin_email: string;
  subject: string;
  message: string;
  created_at: string;
  seen_at: string | null;
};

export type IntegrationRequestReply = {
  id: string;
  integration_request_id: string;
  subject: string;
  message: string;
  created_at: string;
};

export default function IntegrationRequestsPage() {
  const [rows, setRows] = useState<IntegrationRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [detailRow, setDetailRow] = useState<IntegrationRequestRow | null>(null);
  const [markingSeenId, setMarkingSeenId] = useState<string | null>(null);

  const [replies, setReplies] = useState<IntegrationRequestReply[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);

  const [replyMode, setReplyMode] = useState(false);
  const [replySubject, setReplySubject] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySubmitting, setReplySubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/integration-requests");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load requests");
        }
        if (!cancelled) {
          setRows(data.requests || []);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!detailRow?.id) {
      setReplies([]);
      setReplyMode(false);
      return;
    }

    setReplyMode(false);
    setReplySubject(`Re: ${detailRow.subject}`);
    setReplyMessage("");
    setReplyError(null);

    let cancelled = false;
    (async () => {
      setRepliesLoading(true);
      try {
        const res = await fetch(`/api/integration-requests/${detailRow.id}/replies`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          const list = data.replies ?? [];
          setReplies(list);
          if (list.length > 0) {
            setReplyMode(false);
          }
        }
      } finally {
        if (!cancelled) {
          setRepliesLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [detailRow?.id, detailRow?.subject]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      if (r.workspace_admin_email.toLowerCase().includes(q)) return true;
      if (String(r.workspace_id).includes(q)) return true;
      if (r.workspace_name.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [rows, search]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  };

  const openDetail = async (r: IntegrationRequestRow) => {
    setDetailRow(r);

    if (r.seen_at != null) {
      return;
    }

    setMarkingSeenId(r.id);
    try {
      const res = await fetch(`/api/integration-requests/${r.id}/mark-seen`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.marked === true) {
        const now = new Date().toISOString();
        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, seen_at: now } : x)));
        setDetailRow((cur) => (cur?.id === r.id ? { ...cur, seen_at: now } : cur));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(MARK_SEEN_EVENT));
        }
      }
    } catch {
      // keep modal open; list count unchanged
    } finally {
      setMarkingSeenId(null);
    }
  };

  const closeDetail = () => {
    setDetailRow(null);
    setReplyMode(false);
    setReplyError(null);
  };

  const submitReply = async () => {
    if (!detailRow) return;
    setReplyError(null);
    const sub = replySubject.trim();
    const msg = replyMessage.trim();
    if (!sub || !msg) {
      setReplyError("Subject and message are required.");
      return;
    }
    setReplySubmitting(true);
    try {
      const res = await fetch(`/api/integration-requests/${detailRow.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: sub, message: msg }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && detailRow) {
          setReplyMode(false);
          try {
            const r2 = await fetch(`/api/integration-requests/${detailRow.id}/replies`);
            const d2 = await r2.json().catch(() => ({}));
            if (r2.ok) {
              setReplies((d2.replies ?? []) as IntegrationRequestReply[]);
            }
          } catch {
            /* ignore */
          }
        }
        setReplyError(typeof data.error === "string" ? data.error : "Could not send reply.");
        return;
      }
      if (data.reply) {
        setReplies((prev) => [...prev, data.reply as IntegrationRequestReply]);
      }
      setReplyMode(false);
      setReplyMessage("");
      setReplySubject(`Re: ${detailRow.subject}`);
    } catch {
      setReplyError("Network error. Try again.");
    } finally {
      setReplySubmitting(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Integration requests</h1>
        <p className="mt-1 text-gray-600">
          Open a request with <strong>View</strong> to mark it read and update the sidebar count. You can send{" "}
          <strong>one</strong> reply per request from the dialog; after that, continue by email. Use search to filter by
          admin email or workspace ID.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
          {error}
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="mb-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by admin email or workspace ID…"
            className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center text-gray-600">
          No integration requests yet.
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center text-gray-600">
          No requests match your search.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-900">Workspace</th>
                <th className="px-4 py-3 font-semibold text-gray-900">Admin email</th>
                <th className="px-4 py-3 font-semibold text-gray-900">Subject</th>
                <th className="px-4 py-3 font-semibold text-gray-900">Message</th>
                <th className="px-4 py-3 font-semibold text-gray-900">Date</th>
                <th className="px-4 py-3 font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/80">
                  <td className="px-4 py-3 text-gray-900">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.workspace_name}</span>
                      <span className="text-gray-500">(ID: {r.workspace_id})</span>
                      {r.seen_at == null && (
                        <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
                          New
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <a
                      href={`mailto:${encodeURIComponent(r.workspace_admin_email)}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {r.workspace_admin_email}
                    </a>
                  </td>
                  <td className="max-w-[200px] px-4 py-3 text-gray-800">{r.subject}</td>
                  <td className="max-w-md px-4 py-3 text-gray-700">
                    <span className="line-clamp-3 whitespace-pre-wrap break-words">{r.message}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">{formatDate(r.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openDetail(r)}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailRow && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
          onClick={closeDetail}
          role="presentation"
        >
          <div
            className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="integration-detail-title"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-200 bg-white px-6 py-4">
              <div className="min-w-0 flex-1 pr-2">
                <h2 id="integration-detail-title" className="text-lg font-semibold text-gray-900">
                  Integration request
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  {formatDate(detailRow.created_at)}
                  {markingSeenId === detailRow.id && (
                    <span className="ml-2 text-indigo-600">Saving…</span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {repliesLoading ? (
                  <span className="px-3 py-2 text-xs text-gray-500" aria-hidden>
                    …
                  </span>
                ) : replies.length > 0 ? (
                  <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                    Reply sent
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setReplyMode((v) => !v);
                      setReplyError(null);
                    }}
                    className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
                  >
                    {replyMode ? "Cancel reply" : "Reply"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeDetail}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {replyMode && replies.length === 0 && (
              <div className="border-b border-gray-200 bg-indigo-50/50 px-6 py-4">
                <p className="mb-3 text-sm font-medium text-gray-800">Email the workspace admin</p>
                {replyError && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {replyError}
                  </div>
                )}
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Subject
                </label>
                <input
                  type="text"
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                  maxLength={300}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  disabled={replySubmitting}
                />
                <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Message
                </label>
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  maxLength={8000}
                  rows={5}
                  className="mt-1 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  disabled={replySubmitting}
                  placeholder="Your response…"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReplyMode(false);
                      setReplyError(null);
                    }}
                    disabled={replySubmitting}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitReply}
                    disabled={replySubmitting}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {replySubmitting ? "Sending…" : "Send email"}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4 px-6 py-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Workspace</p>
                <p className="mt-1 text-gray-900">
                  <span className="font-medium">{detailRow.workspace_name}</span>
                  <span className="text-gray-500"> (ID: {detailRow.workspace_id})</span>
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Admin email</p>
                <p className="mt-1">
                  <a
                    href={`mailto:${encodeURIComponent(detailRow.workspace_admin_email)}`}
                    className="font-medium text-indigo-600 hover:underline"
                  >
                    {detailRow.workspace_admin_email}
                  </a>
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Subject</p>
                <p className="mt-1 font-medium text-gray-900">{detailRow.subject}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Message</p>
                <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-gray-50 px-3 py-3 text-gray-800">
                  {detailRow.message}
                </p>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Your reply (email log)</p>
                {repliesLoading ? (
                  <p className="mt-2 text-sm text-gray-500">Loading…</p>
                ) : replies.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">No replies sent yet from this dashboard.</p>
                ) : (
                  <ul className="mt-2 space-y-3">
                    {replies.map((rep) => (
                      <li
                        key={rep.id}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-3 shadow-sm"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-medium text-gray-900">{rep.subject}</span>
                          <span className="text-xs text-gray-500">{formatDate(rep.created_at)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-700">{rep.message}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={closeDetail}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
