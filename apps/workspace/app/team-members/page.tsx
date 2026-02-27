"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ConfirmModal } from "@/src/components/ui/ConfirmModal";

interface Department {
  id: number;
  name: string;
}

interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: string | null;
  departments: number[];
  created_at: string;
  email_confirmed_at: string | null;
  deactivated: boolean;
}

export default function TeamMembersPage() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [memberFormData, setMemberFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "service_provider",
    departments: [] as number[],
  });
  const [inviteFormData, setInviteFormData] = useState({
    email: "",
    role: "service_provider",
    departments: [] as number[],
  });
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    action: "deactivate" | "activate";
    memberId: string;
  } | null>(null);

  useEffect(() => {
    fetchTeamMembers();
    fetchDepartments();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/team-members', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data.teamMembers || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch team members');
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
      setError('An error occurred while fetching team members');
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/departments', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const handleNewMember = () => {
    setEditingMember(null);
    setMemberFormData({
      name: "",
      email: "",
      password: "",
      role: "service_provider",
      departments: [],
    });
    setError(null);
    setSuccess(null);
    setShowInviteForm(false);
    setShowMemberForm(true);
  };

  const handleInviteMember = () => {
    setInviteFormData({
      email: "",
      role: "service_provider",
      departments: [],
    });
    setInviteUrl(null);
    setError(null);
    setSuccess(null);
    setShowMemberForm(false);
    setShowInviteForm(true);
  };

  const handleEditMember = (member: TeamMember) => {
    setEditingMember(member);
    setMemberFormData({
      name: member.name,
      email: member.email,
      password: "", // Don't show password for editing
      role: member.role || "service_provider",
      departments: member.departments || [],
    });
    setError(null);
    setSuccess(null);
    setShowMemberForm(true);
  };

  const handleMemberFormCancel = () => {
    setShowMemberForm(false);
    setEditingMember(null);
    setMemberFormData({
      name: "",
      email: "",
      password: "",
      role: "service_provider",
      departments: [],
    });
    setError(null);
    setSuccess(null);
  };

  const handleInviteFormCancel = () => {
    setShowInviteForm(false);
    setInviteFormData({
      email: "",
      role: "service_provider",
      departments: [],
    });
    setInviteUrl(null);
    setError(null);
    setSuccess(null);
  };

  const toggleDepartment = (departmentId: number) => {
    setMemberFormData(prev => {
      const departments = prev.departments.includes(departmentId)
        ? prev.departments.filter(id => id !== departmentId)
        : [...prev.departments, departmentId];
      return { ...prev, departments };
    });
  };

  const toggleInviteDepartment = (departmentId: number) => {
    setInviteFormData(prev => {
      const departments = prev.departments.includes(departmentId)
        ? prev.departments.filter(id => id !== departmentId)
        : [...prev.departments, departmentId];
      return { ...prev, departments };
    });
  };

  const handleMemberFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const url = '/api/team-members';
      const method = editingMember ? 'PUT' : 'POST';
      const body = editingMember
        ? {
            id: editingMember.id,
            name: memberFormData.name,
            email: memberFormData.email,
            role: memberFormData.role,
            departments: memberFormData.departments,
          }
        : {
            name: memberFormData.name,
            email: memberFormData.email,
            password: memberFormData.password,
            role: memberFormData.role,
            departments: memberFormData.departments,
          };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setSuccess(editingMember ? 'Team member updated successfully' : 'Team member created successfully');
        await fetchTeamMembers();
        setTimeout(() => {
          handleMemberFormCancel();
        }, 1500);
      } else {
        const errorData = await response.json();
        setError(errorData.error || (editingMember ? 'Failed to update team member' : 'Failed to create team member'));
      }
    } catch (error) {
      console.error('Error saving team member:', error);
      setError('An error occurred while saving the team member');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateClick = (memberId: string) =>
    setConfirmModal({ action: "deactivate", memberId });

  const handleActivateClick = (memberId: string) =>
    setConfirmModal({ action: "activate", memberId });

  const handleConfirmAction = async () => {
    if (!confirmModal) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        setConfirmModal(null);
        setLoading(false);
        return;
      }

      const isDeactivate = confirmModal.action === "deactivate";
      const response = await fetch(`/api/team-members?id=${confirmModal.memberId}`, {
        method: isDeactivate ? 'DELETE' : 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        setSuccess(
          isDeactivate
            ? 'Team member deactivated successfully'
            : 'Team member activated successfully'
        );
        await fetchTeamMembers();
        setConfirmModal(null);
      } else {
        const errorData = await response.json();
        setError(
          errorData.error ||
            (isDeactivate ? 'Failed to deactivate team member' : 'Failed to activate team member')
        );
        setConfirmModal(null);
      }
    } catch (err) {
      const isDeactivate = confirmModal.action === "deactivate";
      console.error(isDeactivate ? 'Error deactivating team member:' : 'Error activating team member:', err);
      setError(
        confirmModal.action === "deactivate"
          ? 'An error occurred while deactivating the team member'
          : 'An error occurred while activating the team member'
      );
      setConfirmModal(null);
    } finally {
      setLoading(false);
    }
  };

  const getDepartmentNames = (departmentIds: number[]): string[] => {
    return departmentIds
      .map(id => departments.find(d => d.id === id)?.name)
      .filter((name): name is string => name !== undefined);
  };

  const handleInviteFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: inviteFormData.email,
          role: inviteFormData.role,
          departments: inviteFormData.departments,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess('Invite created successfully!');
        setInviteUrl(data.inviteUrl);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create invite');
      }
    } catch (error) {
      console.error('Error creating invite:', error);
      setError('An error occurred while creating the invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6 rounded-xl">
      <header className="flex flex-wrap justify-between relative gap-3">
        <div className="text-sm text-slate-500">
          <h3 className="text-xl font-semibold text-slate-800">Team Members</h3>
          <p className="text-xs text-slate-500">Manage your team members and their access.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleInviteMember}
            className="cursor-pointer text-sm font-bold text-green-600 transition hover:text-green-700"
          >
            + Invite Team Member
          </button>
          <button
            onClick={handleNewMember}
            className="cursor-pointer text-sm font-bold text-indigo-600 transition hover:text-indigo-700"
          >
            + New Team Member
          </button>
        </div>
      </header>

      {/* Error/Success Messages */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-green-800">{success}</p>
          </div>
        </div>
      )}

      {/* Team Members List */}
      <div className="rounded-2xl bg-white shadow-md p-6">
        {teamMembers.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-slate-900">No team members</h3>
            <p className="mt-1 text-sm text-slate-500">Get started by adding your first team member.</p>
            <div className="mt-6">
              <button
                onClick={handleNewMember}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Team Member
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {teamMembers.map((member) => {
              const departmentNames = getDepartmentNames(member.departments);
              return (
                <div
                  key={member.id}
                  className={`flex items-start gap-4 p-4 rounded-xl border ${
                    member.deactivated
                      ? 'border-slate-200 bg-slate-50 opacity-60'
                      : 'border-slate-200 bg-white hover:shadow-sm'
                  } transition`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-medium">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-base font-medium text-slate-800">
                          {member.name}
                          {member.deactivated && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-600">
                              Deactivated
                            </span>
                          )}
                        </h4>
                        <p className="text-sm text-slate-600">{member.email}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 items-center">
                      {member.role && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {member.role.replace('_', ' ')}
                        </span>
                      )}
                      {departmentNames.length > 0 && (
                        <>
                          {departmentNames.map((name) => (
                            <span
                              key={name}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                            >
                              {name}
                            </span>
                          ))}
                        </>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      Added {new Date(member.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleEditMember(member)}
                      className="inline-flex items-center rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition"
                      disabled={loading || member.deactivated}
                    >
                      Edit
                    </button>
                    {!member.deactivated ? (
                      <button
                        onClick={() => handleDeactivateClick(member.id)}
                        className="inline-flex items-center rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition"
                        disabled={loading}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => handleActivateClick(member.id)}
                        className="inline-flex items-center rounded-md bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition"
                        disabled={loading}
                      >
                        Activate
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Team Member Form Modal */}
      {showMemberForm && (
        <div className={`fixed inset-0 z-40 flex m-0 justify-end transition-opacity duration-200 ${showMemberForm ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
          <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${showMemberForm ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" onClick={handleMemberFormCancel} />
          <section className={`relative h-full w-full max-w-xl transform bg-white shadow-2xl transition-transform duration-300 ${showMemberForm ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  {editingMember ? "Edit Team Member" : "Create New Team Member"}
                </h2>
                <p className="text-xs text-slate-500 mt-1">Fill in the team member details below</p>
              </div>
              <button className="rounded-full p-2 text-gray-500 hover:bg-gray-100 transition" aria-label="Close form" onClick={handleMemberFormCancel}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-[calc(100%-4rem)] overflow-y-auto p-6">
              <form onSubmit={handleMemberFormSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={memberFormData.name}
                    onChange={(e) => setMemberFormData({ ...memberFormData, name: e.target.value })}
                    placeholder="e.g., John Doe"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={memberFormData.email}
                    onChange={(e) => setMemberFormData({ ...memberFormData, email: e.target.value })}
                    placeholder="e.g., john@example.com"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                    required
                  />
                </div>

                {!editingMember && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-700">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={memberFormData.password}
                      onChange={(e) => setMemberFormData({ ...memberFormData, password: e.target.value })}
                      placeholder="Minimum 6 characters"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                      required
                      minLength={6}
                    />
                    <p className="mt-1 text-xs text-slate-500">Password must be at least 6 characters long</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={memberFormData.role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      // Clear departments if role is not service_provider
                      setMemberFormData({
                        ...memberFormData,
                        role: newRole,
                        departments: newRole === 'service_provider' ? memberFormData.departments : [],
                      });
                    }}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                    required
                  >
                    <option value="workspace_admin">Workspace Admin</option>
                    <option value="manager">Manager</option>
                    <option value="service_provider">Service Provider</option>
                    <option value="customer">Customer</option>
                  </select>
                  <p className="mt-1 text-xs text-slate-500">Select the role for this team member</p>
                </div>

                {/* Departments Selector - Only show for service_provider role */}
                {memberFormData.role === 'service_provider' && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">
                    Departments
                  </label>

                  {/* Selected Departments Chips */}
                  {memberFormData.departments.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {memberFormData.departments.map((departmentId) => {
                        const department = departments.find(d => d.id === departmentId);
                        if (!department) return null;
                        return (
                          <span
                            key={departmentId}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"
                          >
                            {department.name}
                            <button
                              type="button"
                              onClick={() => toggleDepartment(departmentId)}
                              className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-indigo-200 transition"
                              aria-label={`Remove ${department.name}`}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Departments List */}
                  {departments.length > 0 ? (
                    <div className="border border-slate-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                      <div className="space-y-2">
                        {departments.map((department) => (
                          <button
                            key={department.id}
                            type="button"
                            onClick={() => toggleDepartment(department.id)}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm transition ${
                              memberFormData.departments.includes(department.id)
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {memberFormData.departments.includes(department.id) ? (
                                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              )}
                              {department.name}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500 border border-slate-300 rounded-lg p-3">
                      No departments available. Create departments first to assign them to team members.
                    </div>
                  )}
                  <p className="mt-1 text-xs text-slate-500">Select departments for this team member (optional)</p>
                </div>
                )}

                <div className="flex gap-3 justify-end pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleMemberFormCancel}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : (editingMember ? 'Update Team Member' : 'Create Team Member')}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {/* Invite Team Member Form Modal */}
      {showInviteForm && (
        <div className={`fixed inset-0 z-40 flex m-0 justify-end transition-opacity duration-200 ${showInviteForm ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
          <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${showInviteForm ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" onClick={handleInviteFormCancel} />
          <section className={`relative h-full w-full max-w-xl transform bg-white shadow-2xl transition-transform duration-300 ${showInviteForm ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Invite Team Member</h2>
                <p className="text-xs text-slate-500 mt-1">Send an invitation to join your workspace</p>
              </div>
              <button className="rounded-full p-2 text-gray-500 hover:bg-gray-100 transition" aria-label="Close form" onClick={handleInviteFormCancel}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-[calc(100%-4rem)] overflow-y-auto p-6">
              {inviteUrl ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm font-medium text-green-800">Invite Created Successfully!</p>
                    </div>
                    <p className="text-xs text-green-700">Share this link with the team member:</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-700">Invite Link</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inviteUrl}
                        readOnly
                        className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 bg-slate-50 text-sm"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(inviteUrl);
                          setSuccess('Link copied to clipboard!');
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">This link will expire in 72 hours and can only be used once.</p>
                  </div>

                  <div className="flex gap-3 justify-end pt-6 border-t border-slate-200">
                    <button
                      onClick={handleInviteFormCancel}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleInviteFormSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-700">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={inviteFormData.email}
                      onChange={(e) => setInviteFormData({ ...inviteFormData, email: e.target.value })}
                      placeholder="e.g., john@example.com"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                      required
                    />
                    <p className="mt-1 text-xs text-slate-500">The team member will receive an invitation email</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-700">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={inviteFormData.role}
                      onChange={(e) => {
                        const newRole = e.target.value;
                        setInviteFormData({
                          ...inviteFormData,
                          role: newRole,
                          departments: newRole === 'service_provider' ? inviteFormData.departments : [],
                        });
                      }}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                      required
                    >
                      <option value="workspace_admin">Workspace Admin</option>
                      <option value="manager">Manager</option>
                      <option value="service_provider">Service Provider</option>
                      <option value="customer">Customer</option>
                    </select>
                    <p className="mt-1 text-xs text-slate-500">Select the role for this team member</p>
                  </div>

                  {/* Departments Selector - Only show for service_provider role */}
                  {inviteFormData.role === 'service_provider' && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-700">
                      Departments
                    </label>

                    {/* Selected Departments Chips */}
                    {inviteFormData.departments.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {inviteFormData.departments.map((departmentId) => {
                          const department = departments.find(d => d.id === departmentId);
                          if (!department) return null;
                          return (
                            <span
                              key={departmentId}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"
                            >
                              {department.name}
                              <button
                                type="button"
                                onClick={() => toggleInviteDepartment(departmentId)}
                                className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-indigo-200 transition"
                                aria-label={`Remove ${department.name}`}
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Departments List */}
                    {departments.length > 0 ? (
                      <div className="border border-slate-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                        <div className="space-y-2">
                          {departments.map((department) => (
                            <button
                              key={department.id}
                              type="button"
                              onClick={() => toggleInviteDepartment(department.id)}
                              className={`w-full text-left px-3 py-2 rounded-md text-sm transition ${
                                inviteFormData.departments.includes(department.id)
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {inviteFormData.departments.includes(department.id) ? (
                                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                )}
                                {department.name}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500 border border-slate-300 rounded-lg p-3">
                        No departments available. Create departments first to assign them to team members.
                      </div>
                    )}
                    <p className="mt-1 text-xs text-slate-500">Select departments for this team member (optional)</p>
                  </div>
                  )}

                  <div className="flex gap-3 justify-end pt-6 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleInviteFormCancel}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={loading}
                    >
                      {loading ? 'Creating Invite...' : 'Create Invite'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>
        </div>
      )}

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.action === "deactivate" ? "Deactivate Team Member" : "Activate Team Member"}
          message={
            confirmModal.action === "deactivate"
              ? "Are you sure you want to deactivate this team member?"
              : "Are you sure you want to activate this team member?"
          }
          confirmLabel={confirmModal.action === "deactivate" ? "Deactivate" : "Activate"}
          variant={confirmModal.action === "deactivate" ? "danger" : "primary"}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmModal(null)}
          loading={loading}
        />
      )}
    </section>
  );
}

