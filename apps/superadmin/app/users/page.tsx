"use client";
import React, { useState, useEffect } from 'react';
import { Pagination, usePagination } from '@app/ui';
import { supabase } from '@/lib/supabaseClient';
import type { Workspace } from '@app/db';

interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  role: string | null;
  name: string | null;
  workspace_id: string | null;
}

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'customer' as 'superadmin' | 'workspace_admin' | 'customer',
    workspace_id: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: '', // For name and email
    role: '', // Filter by role
    workspace_id: '', // Filter by workspace
  });
  const ITEMS_PER_PAGE = 20;

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/users');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users');
      }

      setUsers(data.users || []);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  // Fetch workspaces
  const fetchWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch workspaces');
      }

      setWorkspaces(data.workspaces || []);
    } catch (err: any) {
      console.error('Error fetching workspaces:', err);
    }
  };

  // Setup realtime subscription and fetch data
  useEffect(() => {
    fetchUsers();
    fetchWorkspaces();

    // Subscribe to realtime changes (if needed)
    // Note: Supabase Auth doesn't support realtime subscriptions directly
    // You might need to poll or use a different approach
  }, []);

  // Open modal for adding new user
  const handleAdd = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      name: '',
      role: 'customer',
      workspace_id: '',
    });
    setFormErrors({});
    setModalError(null);
    setIsModalOpen(true);
  };

  // Open modal for editing user
  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '', // Don't pre-fill password
      name: user.name || '',
      role: (user.role as 'superadmin' | 'workspace_admin' | 'customer') || 'customer',
      workspace_id: user.workspace_id || '',
    });
    setFormErrors({});
    setModalError(null);
    setIsModalOpen(true);
  };

  // Open delete confirmation modal
  const handleDeleteClick = (user: User) => {
    setDeletingUser(user);
    setIsDeleteModalOpen(true);
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!formData.role) {
      errors.role = 'Role is required';
    }

    // Password is required only when creating new user
    if (!editingUser && !formData.password.trim()) {
      errors.password = 'Password is required';
    } else if (formData.password && formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    // Workspace is required for customer and workspace_admin roles
    if ((formData.role === 'customer' || formData.role === 'workspace_admin') && !formData.workspace_id) {
      errors.workspace_id = 'Workspace is required for customer and workspace_admin roles';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
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
      const payload: any = {
        email: formData.email.trim(),
        name: formData.name.trim(),
        role: formData.role,
      };

      // Include password only if provided (for new users or when updating)
      if (formData.password) {
        payload.password = formData.password;
      }

      // Include workspace_id for customer and workspace_admin roles
      if ((formData.role === 'customer' || formData.role === 'workspace_admin') && formData.workspace_id) {
        payload.workspace_id = formData.workspace_id;
      }

      const url = editingUser
        ? `/api/users/${editingUser.id}`
        : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || 'Failed to save user';
        setModalError(errorMessage);
        setSubmitting(false);
        return;
      }

      // Close modal and reset form
      setIsModalOpen(false);
      setEditingUser(null);
      setFormData({
        email: '',
        password: '',
        name: '',
        role: 'customer',
        workspace_id: '',
      });
      setModalError(null);

      // Refresh users list
      await fetchUsers();
    } catch (err: any) {
      console.error('Error saving user:', err);
      const errorMessage = err.message || 'Failed to save user';
      setModalError(errorMessage);
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/users/${deletingUser.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      setIsDeleteModalOpen(false);
      setDeletingUser(null);

      // Refresh users list
      await fetchUsers();
    } catch (err: any) {
      console.error('Error deleting user:', err);
      setError(err.message || 'Failed to delete user');
    } finally {
      setSubmitting(false);
    }
  };

  // Get workspace name by ID
  const getWorkspaceName = (workspaceId: string | null): string => {
    if (!workspaceId) return '-';
    const workspace = workspaces.find(w => w.id === workspaceId);
    return workspace ? workspace.name : '-';
  };

  // Format role for display
  const formatRole = (role: string | null): string => {
    if (!role) return '-';
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Filter users based on filter criteria
  const filteredUsers = users.filter((user) => {
    // Search filter (name or email)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const nameMatch = user.name?.toLowerCase().includes(searchLower) || false;
      const emailMatch = user.email?.toLowerCase().includes(searchLower) || false;
      if (!nameMatch && !emailMatch) {
        return false;
      }
    }

    // Role filter
    if (filters.role && user.role !== filters.role) {
      return false;
    }

    // Workspace filter
    if (filters.workspace_id && user.workspace_id !== filters.workspace_id) {
      return false;
    }

    return true;
  });

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      search: '',
      role: '',
      workspace_id: '',
    });
  };

  // Check if any filter is active
  const hasActiveFilters = filters.search !== '' || filters.role !== '' || filters.workspace_id !== '';

  const {
    paginatedItems: paginatedUsers,
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems: totalFiltered,
    handlePageChange,
  } = usePagination(filteredUsers, ITEMS_PER_PAGE);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.role, filters.workspace_id]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="space-y-6">
        <header className="flex flex-wrap justify-between relative gap-3">
          <div className="space-y-3">
            <h1 className="text-xl font-semibold text-slate-800">Users</h1>
            <p className="text-xs text-slate-500">Manage all users in the platform</p>
          </div>
          <button onClick={handleAdd} className="cursor-pointer text-sm font-bold text-indigo-600 transition">+ Add User</button>
        </header>
      </section>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Filters Section */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-100/50 p-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search Filter (Name/Email) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Search (Name/Email)
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Search by name or email..."
              />
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Role
              </label>
              <select
                value={filters.role}
                onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All Roles</option>
                <option value="superadmin">Superadmin</option>
                <option value="workspace_admin">Workspace Admin</option>
                <option value="customer">Customer</option>
              </select>
            </div>

            {/* Workspace Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Workspace
              </label>
              <select
                value={filters.workspace_id}
                onChange={(e) => setFilters({ ...filters, workspace_id: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All Workspaces</option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filters Count */}
          {hasActiveFilters && (
            <div className="text-sm text-slate-600 pt-2 border-t border-slate-200">
              Showing {filteredUsers.length} of {users.length} users
            </div>
          )}
        </div>
      </section>

      {/* Users List */}
      <section className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-lg mb-2">No users found</p>
            <p className="text-sm">Click "Add User" to create your first user</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-lg mb-2">No users match your filters</p>
            <p className="text-sm">
              {hasActiveFilters ? (
                <button
                  onClick={clearFilters}
                  className="text-indigo-600 hover:text-indigo-800 underline"
                >
                  Clear filters
                </button>
              ) : (
                'Click "Add User" to create your first user'
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
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                      Workspace
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
                  {paginatedUsers.map((user) => (
                    <tr key={user.id} className="bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Name">
                        <span className="font-semibold text-slate-900">{user.name || '-'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Email">
                        <span className="text-slate-700">{user.email}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Role">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.role === 'superadmin' 
                            ? 'bg-purple-100 text-purple-800'
                            : user.role === 'workspace_admin'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {formatRole(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Workspace">
                        <span className="text-sm text-slate-700">
                          {getWorkspaceName(user.workspace_id)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Created">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Actions">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 inset-ring inset-ring-indigo-700/10 hover:bg-indigo-100 cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(user)}
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
              itemLabel="users"
            />
          </>
        )}
      </section>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className={`fixed inset-0 z-40 flex m-0 justify-end transition-opacity duration-200 ${ isModalOpen ? 'pointer-events-auto opacity-100' :  'pointer-events-none opacity-0'}`}>
          <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${ isModalOpen ? 'opacity-100' : 'opacity-0' }`} aria-hidden="true" onClick={() => {
                      setIsModalOpen(false);
                      setEditingUser(null);
                      setFormErrors({});
                      setModalError(null);
                    }}/>
          <section className={`relative h-full w-full max-w-xl transform bg-white shadow-2xl transition-transform duration-300 ${ isModalOpen ? 'translate-x-0' : 'translate-x-full' }`}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{editingUser ? 'Edit User' : 'Add New User'}</h2>
              </div>
              <button className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700" aria-label="Close booking form" onClick={() => {
                      setIsModalOpen(false);
                      setEditingUser(null);
                      setFormErrors({});
                      setModalError(null);
                    }}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-[calc(100%-4rem)] overflow-y-auto p-6">
            <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4 p-5 rounded-xl border border-slate-200 bg-gray-50/70">
                {/* Error Message in Modal */}
                {modalError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                    {modalError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                      formErrors.email ? 'border-red-500' : 'border-slate-300'
                    }`}
                    placeholder="user@example.com"
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Password {!editingUser && <span className="text-red-500">*</span>}
                    {editingUser && <span className="text-slate-400 text-xs">(leave empty to keep current)</span>}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                      formErrors.password ? 'border-red-500' : 'border-slate-300'
                    }`}
                    placeholder={editingUser ? "Leave empty to keep current password" : "Password"}
                  />
                  {formErrors.password && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
                  )}
                </div>

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
                    placeholder="Full Name"
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => {
                      const newRole = e.target.value as 'superadmin' | 'workspace_admin' | 'customer';
                      setFormData({ 
                        ...formData, 
                        role: newRole,
                        // Clear workspace_id only if role is superadmin
                        workspace_id: (newRole === 'customer' || newRole === 'workspace_admin') ? formData.workspace_id : ''
                      });
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                      formErrors.role ? 'border-red-500' : 'border-slate-300'
                    }`}
                  >
                    <option value="superadmin">Superadmin</option>
                    <option value="workspace_admin">Workspace Admin</option>
                    <option value="customer">Customer</option>
                  </select>
                  {formErrors.role && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.role}</p>
                  )}
                </div>

                {(formData.role === 'customer' || formData.role === 'workspace_admin') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Workspace <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.workspace_id}
                      onChange={(e) => setFormData({ ...formData, workspace_id: e.target.value })}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                        formErrors.workspace_id ? 'border-red-500' : 'border-slate-300'
                      }`}
                    >
                      <option value="">Select a workspace</option>
                      {workspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                          {workspace.name}
                        </option>
                      ))}
                    </select>
                    {formErrors.workspace_id && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.workspace_id}</p>
                    )}
                    {workspaces.length === 0 && (
                      <p className="mt-1 text-xs text-slate-500">
                        No workspaces available. Please create a workspace first.
                      </p>
                    )}
                  </div>
                )}

                <div className="md:col-span-2 flex justify-end gap-3">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={submitting}
                  >
                    {submitting ? 'Saving...' : editingUser ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && deletingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">Delete User</h2>
            </div>
            <div className="p-6">
              <p className="text-slate-700 mb-4">
                Are you sure you want to delete <strong>{deletingUser.name || deletingUser.email}</strong>? This action cannot be undone.
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
                    setDeletingUser(null);
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

export default UsersPage;