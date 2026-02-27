"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Pagination, usePagination } from '@app/ui';
import { supabase } from '@/lib/supabaseClient';
import type { Workspace } from '@app/db';

const WorkspacesPage: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    primary_color: '',
    accent_color: '',
    logo_url: '',
    billing_customer_id: '',
    // User fields for workspace admin
    admin_email: '',
    admin_password: '',
    admin_name: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [originalLogoUrl, setOriginalLogoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ITEMS_PER_PAGE = 20;

  // Fetch workspaces
  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/workspaces');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch workspaces');
      }

      setWorkspaces(data.workspaces || []);
    } catch (err: any) {
      console.error('Error fetching workspaces:', err);
      setError(err.message || 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  // Setup realtime subscription
  useEffect(() => {
    fetchWorkspaces();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('workspaces-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspaces',
        },
        (payload) => {
          console.log('Realtime update:', payload);
          // Refetch workspaces on any change
          fetchWorkspaces();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Open modal for adding new workspace
  const handleAdd = () => {
    setEditingWorkspace(null);
    setFormData({
      name: '',
      slug: '',
      primary_color: '',
      accent_color: '',
      logo_url: '',
      billing_customer_id: '',
      admin_email: '',
      admin_password: '',
      admin_name: '',
    });
    setFormErrors({});
    setModalError(null);
    setLogoFile(null);
    setLogoPreview(null);
    setOriginalLogoUrl(null);
    setIsModalOpen(true);
  };

  // Open modal for editing workspace
  const handleEdit = (workspace: Workspace) => {
    setEditingWorkspace(workspace);
    const logoUrl = workspace.logo_url || '';
    setFormData({
      name: workspace.name,
      slug: workspace.slug,
      primary_color: workspace.primary_color || '',
      accent_color: workspace.accent_color || '',
      logo_url: logoUrl,
      billing_customer_id: workspace.billing_customer_id || '',
      admin_email: '',
      admin_password: '',
      admin_name: '',
    });
    setFormErrors({});
    setModalError(null);
    setLogoFile(null);
    setLogoPreview(logoUrl || null);
    setOriginalLogoUrl(logoUrl); // Store original logo URL to track changes
    setIsModalOpen(true);
  };

  // Open delete confirmation modal
  const handleDeleteClick = (workspace: Workspace) => {
    setDeletingWorkspace(workspace);
    setIsDeleteModalOpen(true);
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!formData.slug.trim()) {
      errors.slug = 'Slug is required';
    } else if (!/^[a-z0-9_-]+$/.test(formData.slug)) {
      errors.slug = 'Slug must contain only lowercase letters, numbers, hyphens, and underscores';
    }

    if (formData.primary_color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(formData.primary_color)) {
      errors.primary_color = 'Primary color must be a valid hex color (e.g., #FF5733)';
    }

    if (formData.accent_color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(formData.accent_color)) {
      errors.accent_color = 'Accent color must be a valid hex color (e.g., #FF5733)';
    }

    // Validate user fields only when creating (not editing)
    if (!editingWorkspace) {
      if (!formData.admin_email.trim()) {
        errors.admin_email = 'Admin email is required';
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.admin_email)) {
          errors.admin_email = 'Invalid email format';
        }
      }

      if (!formData.admin_password.trim()) {
        errors.admin_password = 'Admin password is required';
      } else if (formData.admin_password.length < 6) {
        errors.admin_password = 'Password must be at least 6 characters';
      }

      if (!formData.admin_name.trim()) {
        errors.admin_name = 'Admin name is required';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle logo file selection
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validImageTypes.includes(file.type)) {
        setFormErrors({ ...formErrors, logo: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' });
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        setFormErrors({ ...formErrors, logo: 'File size too large. Maximum size is 5MB.' });
        return;
      }

      setLogoFile(file);
      setFormErrors({ ...formErrors, logo: '' });

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle logo upload
  const handleLogoUpload = async (): Promise<string | null> => {
    if (!logoFile) {
      return formData.logo_url || null;
    }

    setUploadingLogo(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', logoFile);
      if (editingWorkspace) {
        uploadFormData.append('workspaceId', editingWorkspace.id);
      }

      const response = await fetch('/api/workspaces/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload logo');
      }

      return data.url;
    } catch (err: any) {
      console.error('Error uploading logo:', err);
      setFormErrors({ ...formErrors, logo: err.message || 'Failed to upload logo' });
      return null;
    } finally {
      setUploadingLogo(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setModalError(null);

    try {
      // Upload logo ONLY if a new file was selected (not just URL change)
      let logoUrl = formData.logo_url || '';
      
      // Only upload if a new file was actually selected
      if (logoFile) {
        console.log('New logo file selected, uploading...');
        const uploadedUrl = await handleLogoUpload();
        if (uploadedUrl) {
          logoUrl = uploadedUrl;
          console.log('Logo uploaded successfully:', uploadedUrl);
        } else {
          // If upload failed, don't proceed with form submission
          setSubmitting(false);
          return;
        }
      } else if (editingWorkspace) {
        // When editing, if no new file was selected, use the existing logo_url
        // Check if logo_url was manually changed via URL input
        if (formData.logo_url !== originalLogoUrl) {
          // User changed the URL manually, use the new URL
          logoUrl = formData.logo_url;
          console.log('Logo URL manually changed to:', logoUrl);
        } else {
          // No changes to logo, keep the original
          logoUrl = originalLogoUrl || '';
          console.log('No logo changes, keeping original:', logoUrl);
        }
      }

      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim().toLowerCase(),
        primary_color: formData.primary_color.trim() || null,
        accent_color: formData.accent_color.trim() || null,
        logo_url: logoUrl ? logoUrl.trim() : null,
        billing_customer_id: formData.billing_customer_id.trim() || null,
        // Include user fields only when creating (not editing)
        ...(!editingWorkspace && {
          admin_email: formData.admin_email.trim(),
          admin_password: formData.admin_password,
          admin_name: formData.admin_name.trim(),
        }),
      };

      console.log('Submitting workspace with logo_url:', payload.logo_url);

      const url = editingWorkspace
        ? `/api/workspaces/${editingWorkspace.id}`
        : '/api/workspaces';
      const method = editingWorkspace ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        // Display error in modal
        const errorMessage = data.error || 'Failed to save workspace';
        setModalError(errorMessage);
        setSubmitting(false);
        return;
      }

      // Verify logo_url was saved
      if (data.workspace) {
        console.log('Workspace saved successfully. Logo URL:', data.workspace.logo_url);
        if (logoUrl && !data.workspace.logo_url) {
          console.warn('Warning: Logo URL was not saved to database');
        }
      }

      // Close modal and reset form
      setIsModalOpen(false);
      setEditingWorkspace(null);
      setFormData({
        name: '',
        slug: '',
        primary_color: '',
        accent_color: '',
        logo_url: '',
        billing_customer_id: '',
        admin_email: '',
        admin_password: '',
        admin_name: '',
      });
      setLogoFile(null);
      setLogoPreview(null);
      setOriginalLogoUrl(null);
      setModalError(null);

      // Realtime subscription will handle the refresh, but we can also manually refresh
      await fetchWorkspaces();
    } catch (err: any) {
      console.error('Error saving workspace:', err);
      const errorMessage = err.message || 'Failed to save workspace';
      setModalError(errorMessage);
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!deletingWorkspace) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${deletingWorkspace.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete workspace');
      }

      setIsDeleteModalOpen(false);
      setDeletingWorkspace(null);

      // Realtime subscription will handle the refresh
      await fetchWorkspaces();
    } catch (err: any) {
      console.error('Error deleting workspace:', err);
      setError(err.message || 'Failed to delete workspace');
    } finally {
      setSubmitting(false);
    }
  };

  const {
    paginatedItems: paginatedWorkspaces,
    currentPage,
    totalPages,
    totalItems: totalWorkspaces,
    handlePageChange,
  } = usePagination(workspaces, ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="space-y-6">
        <header className="flex flex-wrap justify-between relative gap-3">
          <div className="space-y-3">
            <h1 className="text-xl font-semibold text-slate-800">Workspaces</h1>
            <p className="text-xs text-slate-500">Manage all workspaces in the platform</p>
          </div>
          <button onClick={handleAdd} className="cursor-pointer text-sm font-bold text-indigo-600 transition">
            + Add Workspace
          </button>
        </header>
      </section>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Workspaces List */}
      <section className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading workspaces...</div>
        ) : workspaces.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-lg mb-2">No workspaces found</p>
            <p className="text-sm">Click "Add Workspace" to create your first workspace</p>
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
                      Slug
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                      Colors
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
                  {paginatedWorkspaces.map((workspace) => (
                    <tr key={workspace.id} className="bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm text-slate-700" data-label="Name">
                        <div className="item-align-end flex items-center gap-3">
                          {workspace.logo_url ? (
                            <img
                              src={workspace.logo_url}
                              alt={workspace.name}
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                            </div>
                          )}
                          <span className="font-medium text-slate-900">{workspace.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm text-slate-700" data-label="Slug">
                        <code className="text-sm bg-slate-100 px-2 py-1 rounded text-slate-700">
                          {workspace.slug}
                        </code>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm text-slate-700" data-label="Colors">
                        <div className="item-align-end flex items-center gap-2">
                          {workspace.primary_color && (
                            <div
                              className="w-6 h-6 rounded border border-slate-300"
                              style={{ backgroundColor: workspace.primary_color }}
                              title={`Primary: ${workspace.primary_color}`}
                            />
                          )}
                          {workspace.accent_color && (
                            <div
                              className="w-6 h-6 rounded border border-slate-300"
                              style={{ backgroundColor: workspace.accent_color }}
                              title={`Accent: ${workspace.accent_color}`}
                            />
                          )}
                          {!workspace.primary_color && !workspace.accent_color && (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm text-slate-700" data-label="Created">
                        {new Date(workspace.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm text-slate-700" data-label="Actions">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(workspace)}
                            className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 inset-ring inset-ring-indigo-700/10 hover:bg-indigo-100 cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(workspace)}
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
              totalItems={totalWorkspaces}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={handlePageChange}
              loading={loading}
              itemLabel="workspaces"
            />
          </>
        )}
      </section>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className={`fixed inset-0 z-40 flex m-0 justify-end transition-opacity duration-200 ${ isModalOpen ? 'pointer-events-auto opacity-100' :  'pointer-events-none opacity-0'}`}>
          <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${ isModalOpen ? 'opacity-100' : 'opacity-0' }`} aria-hidden="true" onClick={() => {
                      setIsModalOpen(false);
                      setEditingWorkspace(null);
                      setFormErrors({});
                      setModalError(null);
                      setLogoFile(null);
                      setLogoPreview(null);
                      setOriginalLogoUrl(null);
                    }}/>
          <section className={`relative h-full w-full max-w-xl transform bg-white shadow-2xl transition-transform duration-300 ${ isModalOpen ? 'translate-x-0' : 'translate-x-full' }`}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{editingWorkspace ? 'Edit Workspace' : 'Add New Workspace'}</h2>
              </div>
              <button className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 cursor-pointer" aria-label="Close booking form" onClick={() => {
                      setIsModalOpen(false);
                      setEditingWorkspace(null);
                      setFormErrors({});
                      setModalError(null);
                      setLogoFile(null);
                      setLogoPreview(null);
                      setOriginalLogoUrl(null);
                    }}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-[calc(100%-4rem)] overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="grid gap-4 p-5 rounded-xl border border-slate-200 bg-gray-50/70">
                {/* Error Message in Modal */}
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
                    placeholder="Workspace Name"
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Slug <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                      formErrors.slug ? 'border-red-500' : 'border-slate-300'
                    }`}
                    placeholder="workspace-slug"
                  />
                  {formErrors.slug && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.slug}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    Lowercase letters, numbers, hyphens, and underscores only
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Primary Color
                    </label>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-full h-12 rounded-lg border border-slate-300 cursor-pointer"
                        style={{ backgroundColor: formData.primary_color || '#FF5733' }}
                        onClick={() => document.getElementById('primary-color-input')?.click()}
                      />
                      <input
                        id="primary-color-input"
                        type="color"
                        value={formData.primary_color || '#FF5733'}
                        onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                        className="sr-only"
                      />
                      <input
                        type="text"
                        value={formData.primary_color}
                        onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                        className={`w-32 px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                          formErrors.primary_color ? 'border-red-500' : 'border-slate-300'
                        }`}
                        placeholder="#FF5733"
                      />
                    </div>
                    {formErrors.primary_color && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.primary_color}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Accent Color
                    </label>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-full h-12 rounded-lg border border-slate-300 cursor-pointer"
                        style={{ backgroundColor: formData.accent_color || '#33C3F0' }}
                        onClick={() => document.getElementById('accent-color-input')?.click()}
                      />
                      <input
                        id="accent-color-input"
                        type="color"
                        value={formData.accent_color || '#33C3F0'}
                        onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                        className="sr-only"
                      />
                      <input
                        type="text"
                        value={formData.accent_color}
                        onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                        className={`w-32 px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                          formErrors.accent_color ? 'border-red-500' : 'border-slate-300'
                        }`}
                        placeholder="#33C3F0"
                      />
                    </div>
                    {formErrors.accent_color && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.accent_color}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Logo
                  </label>
                  
                  {/* Logo Preview */}
                  {(logoPreview || formData.logo_url) && (
                    <div className="mb-3 flex items-center gap-3">
                      <img
                        src={logoPreview || formData.logo_url}
                        alt="Logo preview"
                        className="w-24 h-24 object-cover rounded-lg border border-slate-300"
                      />
                      {logoFile && (
                        <button
                          type="button"
                          onClick={() => {
                            setLogoFile(null);
                            setLogoPreview(formData.logo_url || null);
                            // Reset file input
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                          className="text-sm text-red-600 hover:text-red-800 px-3 py-1 rounded hover:bg-red-50 transition"
                        >
                          Remove File
                        </button>
                      )}
                    </div>
                  )}

                  {/* File Upload Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleLogoFileChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    disabled={uploadingLogo}
                  />
                  {formErrors.logo && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.logo}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    Upload a logo image (JPEG, PNG, GIF, or WebP). Maximum size: 5MB.
                    {editingWorkspace && !logoFile && ' Leave empty to keep existing logo.'}
                  </p>

                  {/* Alternative: Manual URL input */}
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Or enter logo URL manually:
                    </label>
                    <input
                      type="url"
                      value={formData.logo_url}
                      onChange={(e) => {
                        setFormData({ ...formData, logo_url: e.target.value });
                        if (e.target.value) {
                          setLogoPreview(e.target.value);
                        } else if (!logoFile) {
                          setLogoPreview(null);
                        }
                      }}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Billing Customer ID
                  </label>
                  <input
                    type="text"
                    value={formData.billing_customer_id}
                    onChange={(e) => setFormData({ ...formData, billing_customer_id: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="cus_xxxxx"
                  />
                </div>

                {/* User Information Section - Only show when creating (not editing) */}
                {!editingWorkspace && (
                  <>
                    <div className="pt-4 border-t border-slate-200">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Workspace Admin User</h3>
                      <p className="text-sm text-slate-600 mb-4">
                        Create a workspace admin user for this workspace. This user will have admin access to manage the workspace.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Admin Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.admin_name}
                        onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                          formErrors.admin_name ? 'border-red-500' : 'border-slate-300'
                        }`}
                        placeholder="John Doe"
                      />
                      {formErrors.admin_name && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.admin_name}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Admin Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={formData.admin_email}
                        onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                          formErrors.admin_email ? 'border-red-500' : 'border-slate-300'
                        }`}
                        placeholder="admin@example.com"
                      />
                      {formErrors.admin_email && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.admin_email}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Admin Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={formData.admin_password}
                        onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                          formErrors.admin_password ? 'border-red-500' : 'border-slate-300'
                        }`}
                        placeholder="••••••••"
                      />
                      {formErrors.admin_password && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.admin_password}</p>
                      )}
                      <p className="mt-1 text-xs text-slate-500">
                        Password must be at least 6 characters long
                      </p>
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    disabled={submitting || uploadingLogo}
                  >
                    {uploadingLogo ? 'Uploading...' : submitting ? 'Saving...' : editingWorkspace ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && deletingWorkspace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">Delete Workspace</h2>
            </div>
            <div className="p-6">
              <p className="text-slate-700 mb-4">
                Are you sure you want to delete <strong>{deletingWorkspace.name}</strong>? This action cannot be undone.
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
                    setDeletingWorkspace(null);
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

export default WorkspacesPage;