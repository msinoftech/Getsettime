"use client";

import React, { useState, useEffect } from "react";
import * as AppIcons from "@app/icons";
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
  icon?: string | null;
}

type IconComponent = React.ComponentType<{ className?: string }>;

const ICON_OPTIONS: Array<{
  key: string;
  label: string;
  icon: IconComponent;
}> = Object.entries(AppIcons)
  .filter(([key, value]) => {
    if (typeof value !== "function") return false;
    return key.startsWith("Fc") || key.startsWith("Fa") || key.startsWith("Md");
  })
  .map(([key, value]) => {
    const label = key
      .replace(/^(Fc|Fa|Md)/, "")
      .replace(/([A-Z])/g, " $1")
      .trim();
    return {
      key,
      label,
      icon: value as IconComponent,
    };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

const DEFAULT_ICON_KEY = "FcBriefcase";
const CUSTOM_ICON_PREFIX = "data:image/";
const MAX_CUSTOM_ICON_PX = 50;

const isCustomIconValue = (iconValue: string | null | undefined): iconValue is string => {
  return typeof iconValue === "string" && iconValue.startsWith(CUSTOM_ICON_PREFIX);
};

function resolve_icon_option(iconValue: string | null | undefined) {
  return (
    ICON_OPTIONS.find((item) => item.key === iconValue) ||
    ICON_OPTIONS.find((item) => item.key === DEFAULT_ICON_KEY)!
  );
}

function read_image_size(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Failed to read icon image"));
    img.src = src;
  });
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
  const [formIcon, setFormIcon] = useState(DEFAULT_ICON_KEY);
  const [iconSearch, setIconSearch] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [professionOptions, setProfessionOptions] = useState<ProfessionOption[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ search: "", profession_id: "" });
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
    setFormIcon(DEFAULT_ICON_KEY);
    setIconSearch("");
    setUploadingIcon(false);
    setFormErrors({});
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEdit = (row: DepartmentRow) => {
    setEditing(row);
    setFormName(row.name);
    setFormProfessionId(row.profession_id != null ? String(row.profession_id) : "");
    setFormIcon(row.icon || DEFAULT_ICON_KEY);
    setIconSearch("");
    setUploadingIcon(false);
    setFormErrors({});
    setModalError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setIconSearch("");
    setUploadingIcon(false);
    setModalError(null);
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setModalError("Please upload an image file.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setModalError("Icon file size must be 1MB or less.");
      return;
    }

    setUploadingIcon(true);
    setModalError(null);
    try {
      const iconDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read icon file"));
        reader.readAsDataURL(file);
      });
      if (!isCustomIconValue(iconDataUrl)) {
        throw new Error("Unsupported icon format");
      }
      const { width, height } = await read_image_size(iconDataUrl);
      if (width > MAX_CUSTOM_ICON_PX || height > MAX_CUSTOM_ICON_PX) {
        throw new Error(`Custom icon must be ${MAX_CUSTOM_ICON_PX}×${MAX_CUSTOM_ICON_PX} pixels or smaller.`);
      }
      setFormIcon(iconDataUrl);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Failed to upload icon");
    } finally {
      setUploadingIcon(false);
    }
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
        body: JSON.stringify({
          name: formName.trim(),
          profession_id: professionId,
          icon: formIcon,
        }),
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

  const filtered = departments.filter((d) => {
    const matchesSearch = filters.search
      ? d.name.toLowerCase().includes(filters.search.toLowerCase())
      : true;
    const matchesProfession = filters.profession_id
      ? String(d.profession_id) === filters.profession_id
      : true;
    return matchesSearch && matchesProfession;
  });

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
  }, [filters.search, filters.profession_id]);

  const filteredIcons = ICON_OPTIONS.filter((item) => {
    if (!iconSearch.trim()) return true;
    const query = iconSearch.toLowerCase();
    return item.label.toLowerCase().includes(query) || item.key.toLowerCase().includes(query);
  });
  const isCustomSelected = isCustomIconValue(formIcon);
  const selectedIcon = resolve_icon_option(formIcon);
  const SelectedIconComponent = selectedIcon.icon;

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
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-1 sm:min-w-[200px]">
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Search by name..."
            />
            <select
              value={filters.profession_id}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, profession_id: e.target.value }))
              }
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All professions</option>
              {professionOptions.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
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
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Icon</th>
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
                      <td className="px-6 py-4">
                        {isCustomIconValue(row.icon) ? (
                          <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden p-1">
                            <img
                              src={row.icon}
                              alt={`${row.name} icon`}
                              className="h-7 w-7 object-contain"
                            />
                          </span>
                        ) : (
                          (() => {
                            const IconPreview = resolve_icon_option(row.icon).icon;
                            return (
                              <span className="inline-flex items-center justify-center p-2">
                                <IconPreview className="h-5 w-5" />
                              </span>
                            );
                          })()
                        )}
                      </td>
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
                <div className="grid gap-3">
                  <label className="block text-sm font-medium text-slate-700">Icon</label>
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    {isCustomSelected ? (
                      <img
                        src={formIcon}
                        alt="Custom icon preview"
                        className="h-6 w-6 object-contain"
                      />
                    ) : (
                      <SelectedIconComponent className="h-6 w-6" />
                    )}
                    <div className="text-sm text-slate-700">
                      {isCustomSelected
                        ? "Custom uploaded icon"
                        : `${selectedIcon.label} (${selectedIcon.key})`}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      Upload custom icon
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={handleIconUpload}
                        disabled={uploadingIcon}
                      />
                    </label>
                    {isCustomSelected && (
                      <button
                        type="button"
                        onClick={() => setFormIcon(DEFAULT_ICON_KEY)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Use library icon
                      </button>
                    )}
                    {uploadingIcon && <span className="text-xs text-slate-500">Uploading icon...</span>}
                  </div>
                  <p className="text-xs text-slate-500">
                    Custom icons must be {MAX_CUSTOM_ICON_PX}×{MAX_CUSTOM_ICON_PX} pixels or smaller.
                  </p>
                  <input
                    type="text"
                    value={iconSearch}
                    onChange={(e) => setIconSearch(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Search icons..."
                  />
                  <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-3">
                    {filteredIcons.map((iconOption) => {
                      const IconOptionComponent = iconOption.icon;
                      const isSelected = formIcon === iconOption.key;
                      return (
                        <button
                          key={iconOption.key}
                          type="button"
                          onClick={() => setFormIcon(iconOption.key)}
                          className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs transition ${
                            isSelected
                              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                              : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50"
                          }`}
                        >
                          <IconOptionComponent className="h-5 w-5 shrink-0" />
                          <span className="truncate">{iconOption.label}</span>
                        </button>
                      );
                    })}
                    {filteredIcons.length === 0 && (
                      <div className="col-span-full rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
                        No icons match your search.
                      </div>
                    )}
                  </div>
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
