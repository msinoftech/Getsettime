"use client";
import React, { useState, useEffect } from 'react';
import { Pagination, usePagination } from '@app/ui';
import { ProfessionTableSkeleton } from '@/src/components/Professions/ProfessionTableSkeleton';
import * as AppIcons from '@app/icons';

interface Profession {
  id: number;
  name: string;
  created_at: string;
  enabled: boolean;
  icon: string | null;
}

type ProfessionForm = {
  name: string;
  icon: string;
};

type IconComponent = React.ComponentType<{ className?: string }>;

const ICON_OPTIONS: Array<{
  key: string;
  label: string;
  icon: IconComponent;
}> = Object.entries(AppIcons)
  .filter(([key, value]) => {
    if (typeof value !== 'function') return false;
    return key.startsWith('Fc') || key.startsWith('Fa') || key.startsWith('Md');
  })
  .map(([key, value]) => {
    const label = key
      .replace(/^(Fc|Fa|Md)/, '')
      .replace(/([A-Z])/g, ' $1')
      .trim();
    return {
      key,
      label,
      icon: value as IconComponent,
    };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

const DEFAULT_ICON_KEY = 'FcBriefcase';
const CUSTOM_ICON_PREFIX = 'data:image/';

const isCustomIconValue = (iconValue: string | null | undefined): iconValue is string => {
  return typeof iconValue === 'string' && iconValue.startsWith(CUSTOM_ICON_PREFIX);
};

const ProfessionsPage: React.FC = () => {
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingProfession, setEditingProfession] = useState<Profession | null>(null);
  const [deletingProfession, setDeletingProfession] = useState<Profession | null>(null);
  const [formData, setFormData] = useState<ProfessionForm>({ name: '', icon: DEFAULT_ICON_KEY });
  const [iconSearch, setIconSearch] = useState('');
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ search: '' });
  const ITEMS_PER_PAGE = 20;

  const fetchProfessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/professions-list');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch professions');
      }

      const list = (data.professions || []) as Profession[];
      setProfessions(
        list.map((p) => ({
          ...p,
          enabled: p.enabled !== false,
        }))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load professions';
      console.error('Error fetching professions:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfessions();
  }, []);

  const handleAdd = () => {
    setEditingProfession(null);
    setFormData({ name: '', icon: DEFAULT_ICON_KEY });
    setIconSearch('');
    setFormErrors({});
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleEdit = (profession: Profession) => {
    setEditingProfession(profession);
    setFormData({ name: profession.name, icon: profession.icon || DEFAULT_ICON_KEY });
    setIconSearch('');
    setFormErrors({});
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (profession: Profession) => {
    setDeletingProfession(profession);
    setIsDeleteModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProfession(null);
    setIconSearch('');
    setUploadingIcon(false);
    setFormErrors({});
    setModalError(null);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    setError(null);
    setModalError(null);

    try {
      const payload = { name: formData.name.trim(), icon: formData.icon };

      const response = editingProfession
        ? await fetch(`/api/professions-list/${editingProfession.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/professions-list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      const data = await response.json();

      if (!response.ok) {
        setModalError(data.error || 'Failed to save profession');
        setSubmitting(false);
        return;
      }

      closeModal();
      await fetchProfessions();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save profession';
      console.error('Error saving profession:', err);
      setModalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleProfessionEnabled = async (profession: Profession) => {
    try {
      const response = await fetch(`/api/professions-list/${profession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !profession.enabled }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to update profession');
        return;
      }
      setProfessions((prev) =>
        prev.map((p) =>
          p.id === profession.id ? { ...p, enabled: !profession.enabled } : p
        )
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update profession');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProfession) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/professions-list/${deletingProfession.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete profession');
      }

      setIsDeleteModalOpen(false);
      setDeletingProfession(null);
      await fetchProfessions();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete profession';
      console.error('Error deleting profession:', err);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProfessions = professions.filter((profession) => {
    if (filters.search) {
      return profession.name.toLowerCase().includes(filters.search.toLowerCase());
    }
    return true;
  });

  const hasActiveFilters = filters.search !== '';

  const clearFilters = () => {
    setFilters({ search: '' });
  };

  const {
    paginatedItems: paginatedProfessions,
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems: totalFiltered,
    handlePageChange,
  } = usePagination(filteredProfessions, ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search]);

  const filteredIcons = ICON_OPTIONS.filter((item) => {
    if (!iconSearch.trim()) return true;
    const query = iconSearch.toLowerCase();
    return (
      item.label.toLowerCase().includes(query) ||
      item.key.toLowerCase().includes(query)
    );
  });

  const isCustomSelected = isCustomIconValue(formData.icon);
  const selectedIcon =
    ICON_OPTIONS.find((item) => item.key === formData.icon) ??
    ICON_OPTIONS.find((item) => item.key === DEFAULT_ICON_KEY)!;
  const SelectedIconComponent = selectedIcon.icon;

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setModalError('Please upload an image file.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setModalError('Icon file size must be 1MB or less.');
      return;
    }

    setUploadingIcon(true);
    setModalError(null);
    try {
      const reader = new FileReader();
      const iconDataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read icon file'));
        reader.readAsDataURL(file);
      });
      if (!isCustomIconValue(iconDataUrl)) {
        throw new Error('Unsupported icon format');
      }
      setFormData((prev) => ({ ...prev, icon: iconDataUrl }));
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to upload icon');
    } finally {
      setUploadingIcon(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="space-y-6">
        <header className="flex flex-wrap justify-between relative gap-3">
          <div className="space-y-3">
            <h1 className="text-xl font-semibold text-slate-800">Professions</h1>
            <p className="text-xs text-slate-500">
              Global onboarding catalog (professions_list). When a user picks an option or enters Other, a matching row is created or reused in the professions table and linked to their workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="self-start inline-flex items-center rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            + Add profession
          </button>
        </header>
      </section>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Filters Section */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-100/50 px-3 py-3 sm:px-4 sm:py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Left side: filter controls */}
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 md:gap-3">
            <div className="w-full sm:flex-1 sm:min-w-[200px]">
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Search by name..."
              />
            </div>
          </div>

          {/* Right side: reset + count */}
          <div className="flex items-center justify-between gap-3 md:justify-end mt-1 md:mt-0">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[11px] sm:text-xs font-medium text-slate-400 hover:text-slate-600 whitespace-nowrap"
              >
                Reset Filters
              </button>
            )}
            <span className="hidden sm:inline-block text-[11px] sm:text-xs text-slate-400 whitespace-nowrap">
              {filteredProfessions.length} of {professions.length}
            </span>
          </div>
        </div>
      </section>

      {/* Professions List */}
      <section className="overflow-hidden">
        {loading ? (
          <ProfessionTableSkeleton />
        ) : professions.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-lg mb-2">No professions found</p>
            <p className="text-sm">Use &quot;Add profession&quot; above or seed via migration/SQL.</p>
          </div>
        ) : filteredProfessions.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-lg mb-2">No professions match your filters</p>
            <p className="text-sm">
              {hasActiveFilters ? (
                <button
                  onClick={clearFilters}
                  className="text-indigo-600 hover:text-indigo-800 underline"
                >
                  Clear filters
                </button>
              ) : (
                'Adjust filters or add catalog rows in superadmin'
              )}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="border border-slate-200">
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                      Enabled
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-700 tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedProfessions.map((profession) => (
                    <tr key={profession.id} className="bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Name">
                      {(() => {
                          if (isCustomIconValue(profession.icon)) {
                            return (
                              <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden p-1">
                                <img
                                  src={profession.icon}
                                  alt={`${profession.name} icon`}
                                  className="h-7 w-7 object-contain"
                                />
                              </span>
                            );
                          }
                          const iconOption =
                            ICON_OPTIONS.find((item) => item.key === profession.icon) ||
                            ICON_OPTIONS.find((item) => item.key === DEFAULT_ICON_KEY)!;
                          const IconPreview = iconOption.icon;
                          return (
                            <span className="inline-flex items-center justify-center p-2">
                              <IconPreview className="h-5 w-5" />
                            </span>
                          );
                        })()}
                        <span className="inline-flex items-center justify-center font-semibold text-slate-900">{profession.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Enabled">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={profession.enabled}
                            onChange={() => toggleProfessionEnabled(profession)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-slate-600">{profession.enabled ? 'On' : 'Off'}</span>
                        </label>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Created">
                        {new Date(profession.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Actions">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(profession)}
                            className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 inset-ring inset-ring-indigo-700/10 hover:bg-indigo-100 cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(profession)}
                            className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 inset-ring inset-ring-red-600/10 hover:bg-red-100 cursor-pointer"
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
              itemLabel="professions"
            />
          </>
        )}
      </section>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className={`fixed inset-0 z-40 flex m-0 justify-end transition-opacity duration-200 ${ isModalOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
          <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${ isModalOpen ? 'opacity-100' : 'opacity-0' }`} aria-hidden="true" onClick={closeModal} />
          <section className={`relative h-full w-full max-w-xl transform bg-white shadow-2xl transition-transform duration-300 ${ isModalOpen ? 'translate-x-0' : 'translate-x-full' }`}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  {editingProfession ? 'Edit profession' : 'Add profession'}
                </h2>
              </div>
              <button className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700" aria-label="Close form" onClick={closeModal}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
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
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                      formErrors.name ? 'border-red-500' : 'border-slate-300'
                    }`}
                    placeholder="e.g. Doctor, Salon, Artist"
                    autoFocus
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                  )}
                </div>

                <div className="grid gap-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Icon
                  </label>
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    {isCustomSelected ? (
                      <img
                        src={formData.icon}
                        alt="Custom icon preview"
                        className="h-6 w-6 object-contain"
                      />
                    ) : (
                      <SelectedIconComponent className="h-6 w-6" />
                    )}
                    <div className="text-sm text-slate-700">
                      {isCustomSelected ? 'Custom uploaded icon' : `${selectedIcon.label} (${selectedIcon.key})`}
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
                        onClick={() => setFormData((prev) => ({ ...prev, icon: DEFAULT_ICON_KEY }))}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Use library icon
                      </button>
                    )}
                    {uploadingIcon && <span className="text-xs text-slate-500">Uploading icon...</span>}
                  </div>
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
                      const isSelected = formData.icon === iconOption.key;
                      return (
                        <button
                          key={iconOption.key}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, icon: iconOption.key }))}
                          className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs transition ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50'
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
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={submitting}
                  >
                    {submitting ? 'Saving...' : editingProfession ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && deletingProfession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">Delete Profession</h2>
            </div>
            <div className="p-6">
              <p className="text-slate-700 mb-4">
                Are you sure you want to delete <strong>{deletingProfession.name}</strong>? This action cannot be undone.
              </p>
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeletingProfession(null);
                    setError(null);
                  }}
                  className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  {submitting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessionsPage;
