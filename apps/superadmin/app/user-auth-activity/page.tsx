"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pagination } from "@app/ui";
import type { user_auth_activity } from "@/src/types/user_auth_activity";
import type { user_auth_activity_user_summary } from "@/src/types/user_auth_activity_user_summary";
import { UserAuthActivityGroupTableSkeleton } from "@/src/components/UserAuthActivity/UserAuthActivityTableSkeleton";

type WorkspaceOption = { id: number; name: string };

type ApiRow = user_auth_activity;

const ITEMS_PER_PAGE = 25;

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

function format_event_count(n: number | string): string {
  const v = typeof n === "string" ? parseInt(n, 10) : n;
  return Number.isFinite(v) ? String(v) : "0";
}

/** First letter of each alphabetic run uppercased, remainder lowercased (readable “capitalize” in the UI). */
function capitalize_workspace_name(name: string): string {
  if (!name) return name;
  return name.replace(/[A-Za-z]+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export default function UserAuthActivityPage() {
  const [groups, setGroups] = useState<user_auth_activity_user_summary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [workspaceFilter, setWorkspaceFilter] = useState<string>("");
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<{
    user_id: string;
    workspace_id: number;
    user_email: string | null;
  } | null>(null);
  const [detailRows, setDetailRows] = useState<ApiRow[]>([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailPage, setDetailPage] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/workspaces");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to load workspaces");
        const list = (data.workspaces || []) as { id: number; name: string }[];
        if (!cancelled) {
          setWorkspaces(
            list.map((w) => ({ id: w.id, name: w.name || `Workspace ${w.id}` }))
          );
        }
      } catch {
        if (!cancelled) setWorkspaces([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(ITEMS_PER_PAGE));
      if (workspaceFilter.trim()) params.set("workspace_id", workspaceFilter.trim());
      const res = await fetch(`/api/user-auth-activity?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load activity");
      setGroups(data.groups || []);
      setTotal(typeof data.total === "number" ? data.total : 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setGroups([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, workspaceFilter]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const loadDetail = useCallback(async () => {
    if (!detail) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const params = new URLSearchParams();
      params.set("user_id", detail.user_id);
      params.set("workspace_id", String(detail.workspace_id));
      params.set("page", String(detailPage));
      params.set("limit", String(ITEMS_PER_PAGE));
      const res = await fetch(`/api/user-auth-activity?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load logs");
      setDetailRows(data.rows || []);
      setDetailTotal(typeof data.total === "number" ? data.total : 0);
    } catch (e: unknown) {
      setDetailError(e instanceof Error ? e.message : "Failed to load");
      setDetailRows([]);
      setDetailTotal(0);
    } finally {
      setDetailLoading(false);
    }
  }, [detail, detailPage]);

  useEffect(() => {
    if (detail) void loadDetail();
  }, [detail, loadDetail]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)),
    [total]
  );

  const detailTotalPages = useMemo(
    () => Math.max(1, Math.ceil(detailTotal / ITEMS_PER_PAGE)),
    [detailTotal]
  );

  const closeDetail = () => {
    setDetail(null);
    setDetailRows([]);
    setDetailTotal(0);
    setDetailPage(1);
    setDetailError(null);
  };

  const openDetail = (g: user_auth_activity_user_summary) => {
    setDetailPage(1);
    setDetailError(null);
    setDetail({
      user_id: g.user_id,
      workspace_id: g.workspace_id,
      user_email: g.user_email ?? null,
    });
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">User auth activity</h1>
          <p className="mt-1 text-sm text-slate-600">
            Grouped by user and workspace. Use “View logs” for full activity.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex flex-col text-sm text-slate-700">
            <span className="mb-1 font-medium">Workspace</span>
            <select
              className="h-9 w-full min-w-[200px] rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={workspaceFilter}
              onChange={(e) => {
                setWorkspaceFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by workspace"
            >
              <option value="">All workspaces</option>
              {workspaces.map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {capitalize_workspace_name(w.name)} ({w.id})
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <UserAuthActivityGroupTableSkeleton />
        ) : groups.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-lg mb-2">No records found</p>
            {workspaceFilter ? (
              <p className="text-sm">Try clearing the workspace filter</p>
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
                      Workspace
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                      Last activity
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                      Events
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-700 tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {groups.map((g) => (
                    <tr
                      key={`${g.user_id}-${g.workspace_id}`}
                      className="bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-slate-800">
                        <span title={g.user_id}>
                          {g.user_email && g.user_email.trim() !== ""
                            ? g.user_email
                            : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-800">
                        {g.workspace_name
                          ? `${capitalize_workspace_name(g.workspace_name)} (${g.workspace_id})`
                          : String(g.workspace_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">
                        {format_ts(g.last_activity_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-800 tabular-nums">
                        {format_event_count(g.event_count)}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openDetail(g)}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
                        >
                          View logs
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
                itemLabel="users"
              />
            </div>
          </>
        )}
      </section>

      {detail && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
          onClick={closeDetail}
          role="presentation"
        >
          <div
            className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-auth-detail-title"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
              <div className="min-w-0 flex-1 pr-2">
                <h2
                  id="user-auth-detail-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  Activity log
                </h2>
                <p className="mt-1 text-sm text-slate-800 break-all">
                  {detail.user_email && detail.user_email.trim() !== ""
                    ? detail.user_email
                    : "No email on file"}
                </p>
                <p className="mt-0.5 font-mono text-xs text-slate-500 break-all">
                  {detail.user_id} · workspace {detail.workspace_id}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDetail}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {detailError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {detailError}
                </div>
              )}
              {detailLoading ? (
                <div className="py-12 text-center text-slate-500">Loading…</div>
              ) : detailRows.length === 0 ? (
                <div className="py-12 text-center text-slate-500">No events for this user.</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 font-bold text-slate-700">Time</th>
                        <th className="px-4 py-3 font-bold text-slate-700">Event</th>
                        <th className="px-4 py-3 font-bold text-slate-700">Workspace</th>
                        <th className="px-4 py-3 font-bold text-slate-700">Reason</th>
                        <th className="px-4 py-3 font-bold text-slate-700">IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {detailRows.map((r) => {
                        const ws_name =
                          r.workspaces &&
                          typeof r.workspaces === "object" &&
                          "name" in r.workspaces
                            ? String((r.workspaces as { name: string }).name)
                            : "";
                        return (
                          <tr key={r.id} className="bg-white hover:bg-slate-50">
                            <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                              {format_ts(r.created_at)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                              {r.event_type}
                            </td>
                            <td className="px-4 py-3 text-slate-800">
                              {ws_name
                                ? `${capitalize_workspace_name(ws_name)} (${r.workspace_id})`
                                : String(r.workspace_id)}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{r.reason || "—"}</td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-600">
                              {r.ip_address || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {!detailLoading && detailTotal > 0 && (
              <div className="shrink-0 border-t border-slate-200 px-4 pb-4 pt-2">
                <Pagination
                  currentPage={detailPage}
                  totalPages={detailTotalPages}
                  totalItems={detailTotal}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={(p) => {
                    setDetailPage(p);
                  }}
                  loading={detailLoading}
                  itemLabel="events"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
