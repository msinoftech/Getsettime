"use client";

import React, { useState, useEffect } from "react";
import { Pagination, usePagination } from "@app/ui";

interface ProfessionOption {
  id: number;
  name: string;
}

interface DepartmentRow {
  id: number;
  name: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  profession_id: number | null;
  profession_name?: string | null;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentRow | null>(null);
  const [deleting, setDeleting] = useState<DepartmentRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formProfessionId, setFormProfessionId] = useState<string>("");
  const [professionOptions, setProfessionOptions] = useState<ProfessionOption[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ search: "" });
  const ITEMS_PER_PAGE = 20;

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/departments-list");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch departments");
      setDepartments(data.departments || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    const loadProfessions = async () => {
      try {
        const res = await fetch("/api/professions-list");
        const data = await res.json();
        if (!res.ok) return;
        setProfessionOptions((data.professions ?? []) as ProfessionOption[]);
      } catch {
        /* ignore */
      }
    };
    loadProfessions();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormProfessionId("");
    setFormErrors({});
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEdit = (row: DepartmentRow) => {
    setEditing(row);
    setFormName(row.name);
    setFormProfessionId(row.profession_id != null ? String(row.profession_id) : "");
    setFormErrors({});
    setModalError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setModalError(null);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formName.trim()) errors.name = "Name is required";
    else if (formName.trim().length < 2) errors.name = "Name must be at least 2 characters";
    if (!formProfessionId.trim()) errors.profession_id = "Profession is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSubmitting(true);
    setModalError(null);
    try {
      const professionId = Number(formProfessionId);
      if (!Number.isFinite(professionId) || professionId <= 0) {
        setFormErrors((prev) => ({ ...prev, profession_id: "Select a valid profession" }));
        setSubmitting(false);
        return;
      }
      const url = editing ? `/api/departments-list/${editing.id}` : "/api/departments-list";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim(), profession_id: professionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || "Failed to save");
        return;
      }
      closeModal();
      await fetchDepartments();
    } catch (e: unknown) {
      setModalError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleEnabled = async (row: DepartmentRow) => {
    try {
      const res = await fetch(`/api/departments-list/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !row.enabled }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update");
        return;
      }
      setDepartments((prev) =>
        prev.map((d) => (d.id === row.id ? { ...d, enabled: !row.enabled } : d))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/departments-list/${deleting.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setIsDeleteModalOpen(false);
      setDeleting(null);
      await fetchDepartments();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = departments.filter((d) =>
    filters.search ? d.name.toLowerCase().includes(filters.search.toLowerCase()) : true
  );

  const {
    paginatedItems: paginated,
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems: totalFiltered,
    handlePageChange,
  } = usePagination(filtered, ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search]);

  return (
    <div className="space-y-6">
      <section className="space-y-6">
        <header className="flex flex-wrap justify-between relative gap-3">
          <div className="space-y-3">
            <h1 className="text-xl font-semibold text-slate-800">Departments (onboarding)</h1>
            <p className="text-xs text-slate-500">
              Each row is tied to a profession. Onboarding shows only departments for the profession the user chose in step 1.
            </p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="cursor-pointer text-sm font-bold text-indigo-600 transition"
          >
            + Add department
          </button>
        </header>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">{error}</div>
      )}

      <section className="bg-white rounded-xl shadow-sm border border-slate-100/50 px-3 py-3 sm:px-4 sm:py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="w-full sm:flex-1 sm:min-w-[200px]">
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Search by name..."
            />
          </div>
          <span className="text-[11px] sm:text-xs text-slate-400">
            {filtered.length} of {departments.length}
          </span>
        </div>
      </section>

      <section className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading…</div>
        ) : departments.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-lg mb-2">No departments yet</p>
            <p className="text-sm">Add departments for onboarding suggestions.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="border border-slate-200">
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Name</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Profession</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Enabled</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Created</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginated.map((row) => (
                    <tr key={row.id} className="bg-white border border-slate-200 hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">{row.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {row.profession_name ?? (row.profession_id != null ? `ID ${row.profession_id}` : "—")}
                      </td>
                      <td className="px-6 py-4">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={row.enabled}
                            onChange={() => toggleEnabled(row)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-slate-600">{row.enabled ? "On" : "Off"}</span>
                        </label>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {new Date(row.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="inline-flex rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleting(row);
                              setIsDeleteModalOpen(true);
                            }}
                            className="inline-flex rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalFiltered}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={handlePageChange}
              loading={loading}
              itemLabel="departments"
            />
          </>
        )}
      </section>

      {isModalOpen && (
        <div
          className={`fixed inset-0 z-40 flex m-0 justify-end transition-opacity duration-200 ${
            isModalOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div
            className="absolute inset-0 bg-black/40"
            aria-hidden="true"
            onClick={closeModal}
          />
          <section className="relative h-full w-full max-w-xl transform bg-white shadow-2xl transition-transform duration-300 translate-x-0">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-800">
                {editing ? "Edit department" : "Add department"}
              </h2>
              <button
                type="button"
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
                onClick={closeModal}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-[calc(100%-4rem)] overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="grid gap-4 p-5 rounded-xl border border-slate-200 bg-gray-50/70">
                {modalError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                    {modalError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                      formErrors.name ? "border-red-500" : "border-slate-300"
                    }`}
                    placeholder="e.g. General Practice"
                  />
                  {formErrors.name && <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Profession <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formProfessionId}
                    onChange={(e) => setFormProfessionId(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white ${
                      formErrors.profession_id ? "border-red-500" : "border-slate-300"
                    }`}
                  >
                    <option value="">Select profession</option>
                    {professionOptions.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.profession_id && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.profession_id}</p>
                  )}
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {submitting ? "Saving…" : editing ? "Update" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {isDeleteModalOpen && deleting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Delete department</h2>
            <p className="text-slate-700 mb-4">
              Remove <strong>{deleting.name}</strong> from the global list?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleting(null);
                }}
                className="px-4 py-2 bg-slate-100 rounded-lg"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
