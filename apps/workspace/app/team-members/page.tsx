"use client";
import { useState, useEffect, useMemo } from "react";
import {
  LuBadgeCheck,
  LuBriefcase,
  LuCalendar,
  LuClock,
  LuCrown,
  LuEllipsis,
  LuListFilter,
  LuLock,
  LuMail,
  LuPencil,
  LuPhone,
  LuPower,
  LuSearch,
  LuStar,
  LuStethoscope,
  LuUserCog,
  LuUserPlus,
  LuUsers,
} from "react-icons/lu";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/src/providers/AuthProvider";
import { ConfirmModal } from "@/src/components/ui/ConfirmModal";
import { TeamMemberSkeleton } from "@/src/components/ui/TeamMemberSkeleton";
import {
  ASSIGNABLE_ROLES,
  OWNER_DISALLOWED_ROLES,
  MANAGE_ROLES,
  ROLE_SERVICE_PROVIDER,
  formatRoleLabel,
} from "@/src/constants/roles";
import { userActsAsServiceProviderFromMetadata } from "@/lib/service_provider_role";

interface Department {
  id: number;
  name: string;
  meta_data?: {
    service_providers?: { id: string; name: string }[];
  } | null;
}

interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: string | null;
  additional_roles: string[];
  departments: number[];
  phone: string | null;
  created_at: string;
  email_confirmed_at: string | null;
  deactivated: boolean;
  is_workspace_owner: boolean;
  /** Assignments where this user is service_provider_id, Mon–Sun local week */
  bookings_this_week?: number;
}

function teamMemberActsAsServiceProvider(m: TeamMember): boolean {
  return userActsAsServiceProviderFromMetadata({
    role: m.role,
    is_workspace_owner: m.is_workspace_owner,
    additional_roles: m.additional_roles,
  });
}

function getSortedDepartmentIdsForDisplay(
  m: TeamMember,
  depts: Department[]
): number[] {
  const ids = [...new Set(m.departments ?? [])];
  return [...ids].sort((a, b) => {
    const na = depts.find((d) => d.id === a)?.name ?? "";
    const nb = depts.find((d) => d.id === b)?.name ?? "";
    return na.localeCompare(nb);
  });
}

type MemberUiStatus = "active" | "invited" | "onboarding" | "inactive";

type StatusFilter = "all" | MemberUiStatus;

const STATUS_FILTER_CHIPS: { id: StatusFilter; label: string; shortLabel: string }[] =
  [
    { id: "all", label: "All", shortLabel: "All" },
    { id: "active", label: "Active", shortLabel: "Active" },
    { id: "invited", label: "Invited", shortLabel: "Invited" },
    {
      id: "onboarding",
      label: "Onboarding pending",
      shortLabel: "Onboarding",
    },
    { id: "inactive", label: "Inactive", shortLabel: "Inactive" },
  ];

function getMemberUiStatus(
  m: TeamMember,
  depts: Department[]
): MemberUiStatus {
  if (m.deactivated) return "inactive";
  if (!m.email_confirmed_at) return "invited";
  if (
    teamMemberActsAsServiceProvider(m) &&
    getSortedDepartmentIdsForDisplay(m, depts).length === 0
  ) {
    return "onboarding";
  }
  return "active";
}

function getStatusLabel(s: MemberUiStatus): string {
  if (s === "onboarding") return "Onboarding pending";
  if (s === "invited") return "Invited";
  if (s === "inactive") return "Inactive";
  if (s === "active") return "Active";
  return s;
}

function getStatusPillClass(s: MemberUiStatus): string {
  switch (s) {
    case "active":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "invited":
      return "bg-violet-50 text-violet-700 ring-1 ring-violet-200";
    case "onboarding":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "inactive":
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  }
}

function getRolePillClass(role: string | null): string {
  if (!role)
    return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  const map: Record<string, string> = {
    workspace_admin:
      "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
    manager: "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200",
    service_provider: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    staff: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    customer: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  };
  return map[role] ?? "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

function isRecentlyJoined(createdAt: string, deactivated: boolean): boolean {
  if (deactivated) return false;
  return (
    Date.now() - new Date(createdAt).getTime() <
    7 * 24 * 60 * 60 * 1000
  );
}

function formatMemberAddedDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatWeeklyBookingsLabel(count: number): string {
  return count === 1 ? "1 booking this week" : `${count} bookings this week`;
}

/** Local Monday 00:00 → next Monday 00:00 (ISO), for “bookings this week” on the team list. */
function getLocalWeekRangeQueryParams(): { week_start: string; week_end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return {
    week_start: start.toISOString(),
    week_end: end.toISOString(),
  };
}

export default function TeamMembersPage() {
  const { user: currentUser } = useAuth();
  const currentUserRole =
    (currentUser?.user_metadata?.role as string | undefined) ?? null;
  const currentUserIsOwner =
    currentUser?.user_metadata?.is_workspace_owner === true;
  // Owner OR workspace_admin OR manager may manage team members.
  // Service providers and customers see no management buttons.
  const canManageMembers =
    currentUserIsOwner ||
    (currentUserRole !== null && MANAGE_ROLES.includes(currentUserRole));

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [memberFormData, setMemberFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: ROLE_SERVICE_PROVIDER,
    additional_roles: [] as string[],
    departments: [] as number[],
  });
  const [inviteFormData, setInviteFormData] = useState({
    email: "",
    role: ROLE_SERVICE_PROVIDER,
    departments: [] as number[],
  });
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    action: "deactivate" | "activate";
    memberId: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);

  const teamStats = useMemo(() => {
    let active = 0;
    let invited = 0;
    let onboarding = 0;
    let providers = 0;
    for (const m of teamMembers) {
      const s = getMemberUiStatus(m, departments);
      if (s === "active") active++;
      if (s === "invited") invited++;
      if (s === "onboarding") onboarding++;
      if (teamMemberActsAsServiceProvider(m)) providers++;
    }
    return {
      total: teamMembers.length,
      active,
      invited,
      onboarding,
      providers,
    };
  }, [teamMembers, departments]);

  const filteredTeamMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teamMembers.filter((m) => {
      const ui = getMemberUiStatus(m, departments);
      if (statusFilter !== "all" && ui !== statusFilter) return false;
      if (!q) return true;
      const deptNames = getSortedDepartmentIdsForDisplay(m, departments)
        .map((id) => departments.find((d) => d.id === id)?.name)
        .filter(Boolean)
        .join(" ");
      const roleBits = [
        m.role,
        ...m.additional_roles,
        m.is_workspace_owner ? "owner" : null,
      ]
        .filter(Boolean)
        .join(" ");
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        roleBits.toLowerCase().includes(q) ||
        getStatusLabel(ui).toLowerCase().includes(q) ||
        deptNames.toLowerCase().includes(q)
      );
    });
  }, [teamMembers, departments, search, statusFilter]);

  useEffect(() => {
    fetchTeamMembers();
    fetchDepartments();
  }, []);

  useEffect(() => {
    setOpenActionsId(null);
  }, [search, statusFilter, teamMembers]);

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
    } finally {
      setInitialLoading(false);
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
      phone: "",
      password: "",
      role: ROLE_SERVICE_PROVIDER,
      additional_roles: [],
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
      role: ROLE_SERVICE_PROVIDER,
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
      phone: member.phone ?? "",
      password: "", // Don't show password for editing
      role: member.role || ROLE_SERVICE_PROVIDER,
      additional_roles: member.additional_roles ?? [],
      departments: [...new Set(member.departments ?? [])],
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
      phone: "",
      password: "",
      role: ROLE_SERVICE_PROVIDER,
      additional_roles: [],
      departments: [],
    });
    setError(null);
    setSuccess(null);
  };

  const handleInviteFormCancel = () => {
    setShowInviteForm(false);
    setInviteFormData({
      email: "",
      role: ROLE_SERVICE_PROVIDER,
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

  const toggleAdditionalRole = (role: string) => {
    setMemberFormData(prev => {
      const additional_roles = prev.additional_roles.includes(role)
        ? prev.additional_roles.filter(r => r !== role)
        : [...prev.additional_roles, role];
      // Clear departments when service_provider is no longer present in any role slot.
      const stillServiceProvider =
        prev.role === ROLE_SERVICE_PROVIDER || additional_roles.includes(ROLE_SERVICE_PROVIDER);
      return {
        ...prev,
        additional_roles,
        departments: stillServiceProvider ? prev.departments : [],
      };
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
      // additional_roles is only meaningful for owners; send only then to keep payload clean.
      const additionalRolesForOwner = editingMember?.is_workspace_owner
        ? memberFormData.additional_roles.filter(r => r !== memberFormData.role)
        : undefined;
      const body = editingMember
        ? {
            id: editingMember.id,
            name: memberFormData.name,
            email: memberFormData.email,
            phone: memberFormData.phone,
            role: memberFormData.role,
            departments: memberFormData.departments,
            ...(additionalRolesForOwner !== undefined
              ? { additional_roles: additionalRolesForOwner }
              : {}),
          }
        : {
            name: memberFormData.name,
            email: memberFormData.email,
            phone: memberFormData.phone,
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
    <div className="w-full space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-green-800">{success}</p>
          </div>
        </div>
      )}

      {initialLoading ? (
        <TeamMemberSkeleton />
      ) : (
        <div className="mx-auto max-w-7xl">
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_-30px_rgba(15,23,42,0.25)]">
            <div className="border-b border-slate-100 bg-gradient-to-r from-sky-50 via-white to-indigo-50 px-5 py-5 md:px-7 md:py-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white/80 px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm backdrop-blur">
                    <LuUsers className="h-4 w-4" aria-hidden />
                    Team Access Management
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                      Team Members
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-slate-600 md:text-base">
                      Manage team access, invite staff, onboard providers, and control roles with full action history.
                    </p>
                  </div>
                </div>
                {canManageMembers && (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleInviteMember}
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-medium text-emerald-700 shadow-none transition hover:bg-emerald-100"
                    >
                      <LuMail className="mr-2 h-4 w-4" aria-hidden />
                      Invite Staff / Manager
                    </button>
                    <button
                      type="button"
                      onClick={handleNewMember}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      <LuUserPlus className="mr-2 h-4 w-4" aria-hidden />
                      Add Service Provider
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {(
                  [
                    ["Total Members", teamStats.total, LuUsers, "bg-slate-100 text-slate-700"],
                    ["Active Members", teamStats.active, LuBadgeCheck, "bg-emerald-50 text-emerald-700"],
                    ["Pending Invites", teamStats.invited, LuStar, "bg-violet-50 text-violet-700"],
                    [
                      "Provider Onboarding",
                      teamStats.onboarding,
                      LuStethoscope,
                      "bg-amber-50 text-amber-700",
                    ],
                    [
                      "Service Providers",
                      teamStats.providers,
                      LuBriefcase,
                      "bg-sky-50 text-sky-700",
                    ],
                  ] as const
                ).map(([label, value, StatIcon, iconClass]) => (
                  <div
                    key={String(label)}
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex items-center justify-between p-5">
                      <div>
                        <p className="text-sm text-slate-500">{label}</p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
                      </div>
                      <div className={`rounded-2xl p-3 ${iconClass}`}>
                        <StatIcon className="h-5 w-5" aria-hidden />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 md:p-7">
              <div className="mb-5 flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                <div className="relative min-h-12 w-full min-w-0 sm:min-w-[12rem] sm:flex-1">
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-slate-400"
                    aria-hidden
                  >
                    <LuSearch className="h-4 w-4 shrink-0" />
                  </div>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by member name, email, role, department, or status..."
                    className="box-border h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-white pl-12 pr-3 text-sm font-normal leading-normal text-slate-900 shadow-none outline-none focus:ring-2 focus:ring-sky-200"
                  />
                </div>
                <div className="flex w-full min-w-0 shrink-0 flex-nowrap justify-start gap-2 overflow-x-auto overflow-y-hidden pb-1 pt-0.5 [scrollbar-gutter:stable] sm:w-auto sm:pb-0 sm:pt-0">
                  {STATUS_FILTER_CHIPS.map((chip) => {
                    const isActive = statusFilter === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setStatusFilter(chip.id)}
                        className={`inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-sm font-medium transition sm:h-11 sm:px-4 ${
                          isActive
                            ? "bg-slate-900 text-white shadow-sm"
                            : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                        }`}
                      >
                        <LuListFilter
                          className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
                          aria-hidden
                        />
                        <span className="inline lg:hidden">{chip.shortLabel}</span>
                        <span className="hidden lg:inline">{chip.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {teamMembers.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <LuUsers className="h-6 w-6 text-slate-400" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">No team members</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Get started by inviting staff or adding a service provider.
                  </p>
                  {canManageMembers && (
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      <button
                        type="button"
                        onClick={handleInviteMember}
                        className="inline-flex h-11 items-center rounded-xl border border-emerald-200 bg-white px-5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
                      >
                        <LuMail className="mr-2 h-4 w-4" aria-hidden />
                        Invite Staff / Manager
                      </button>
                      <button
                        type="button"
                        onClick={handleNewMember}
                        className="inline-flex h-11 items-center rounded-xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
                      >
                        <LuUserPlus className="mr-2 h-4 w-4" aria-hidden />
                        Add Service Provider
                      </button>
                    </div>
                  )}
                </div>
              ) : filteredTeamMembers.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <LuUsers className="h-6 w-6 text-slate-400" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">No team members found</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Try changing the search or filter, or add a new team member to get started.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredTeamMembers.map((member) => {
                    const displayDeptIds = getSortedDepartmentIdsForDisplay(
                      member,
                      departments
                    );
                    const ui = getMemberUiStatus(member, departments);
                    const roleLocked =
                      member.is_workspace_owner && !currentUserIsOwner;
                    const showActions =
                      canManageMembers && !roleLocked;
                    const canDeactivateThisMember =
                      showActions && !member.is_workspace_owner;
                    return (
                      <div
                        key={member.id}
                        className={`group rounded-[24px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)] ${
                          member.deactivated ? "opacity-70" : ""
                        }`}
                      >
                        <div className="p-5 md:p-6">
                          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                            <div className="flex min-w-0 flex-1 gap-4">
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-lg font-semibold text-white shadow-sm">
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-lg font-semibold text-slate-900">
                                    {member.name}
                                  </h3>
                                  {roleLocked && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                                      <LuLock className="h-3.5 w-3.5" aria-hidden />
                                      Role Locked
                                    </span>
                                  )}
                                  {isRecentlyJoined(member.created_at, member.deactivated) && (
                                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
                                      New
                                    </span>
                                  )}
                                  {member.deactivated && (
                                    <span className="inline-flex items-center rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
                                      Deactivated
                                    </span>
                                  )}
                                </div>

                                <div className="mt-2 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <LuMail className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                                    <span className="truncate">{member.email}</span>
                                  </div>
                                  <div className="flex min-w-0 items-center gap-2">
                                    <LuPhone className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                                    <span>{member.phone?.trim() ? member.phone : "—"}</span>
                                  </div>
                                  <div className="flex min-w-0 items-center gap-2">
                                    <LuCalendar className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                                    <span>
                                      {!member.email_confirmed_at
                                        ? "Pending acceptance"
                                        : `Added ${formatMemberAddedDate(member.created_at)}`}
                                    </span>
                                  </div>
                                  <div className="flex min-w-0 items-center gap-2">
                                    <LuClock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                                    <span>{formatWeeklyBookingsLabel(member.bookings_this_week ?? 0)}</span>
                                  </div>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                  {member.role && (
                                    <span
                                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getRolePillClass(member.role)}`}
                                    >
                                      {formatRoleLabel(member.role)}
                                    </span>
                                  )}
                                  {member.is_workspace_owner &&
                                    member.additional_roles
                                      .filter((r) => r !== member.role)
                                      .map((r) => (
                                        <span
                                          key={r}
                                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getRolePillClass(r)}`}
                                        >
                                          {formatRoleLabel(r)}
                                        </span>
                                      ))}
                                  {member.is_workspace_owner && (
                                    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                                      <LuCrown className="mr-1 h-3.5 w-3.5" aria-hidden />
                                      Owner
                                    </span>
                                  )}
                                  <span
                                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusPillClass(ui)}`}
                                  >
                                    {getStatusLabel(ui)}
                                  </span>
                                </div>

                                {displayDeptIds.length > 0 && (
                                  <div className="mt-2 flex max-h-48 flex-wrap gap-2 overflow-y-auto pr-1">
                                    {displayDeptIds.map((deptId) => {
                                      const name = departments.find(
                                        (d) => d.id === deptId
                                      )?.name;
                                      if (!name) return null;
                                      return (
                                        <span
                                          key={deptId}
                                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                                        >
                                          {name}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>

                            {canManageMembers && (
                              <div className="flex flex-wrap items-start justify-end gap-2 xl:min-w-[280px]">
                                {!showActions ? (
                                  <span className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-500">
                                    <LuLock className="mr-2 h-4 w-4" aria-hidden />
                                    Role Locked
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionsId(null);
                                        handleEditMember(member);
                                      }}
                                      disabled={loading || member.deactivated}
                                      className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
                                    >
                                      <LuPencil className="mr-2 h-4 w-4" aria-hidden />
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionsId(null);
                                        handleEditMember(member);
                                      }}
                                      disabled={loading || member.deactivated}
                                      className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
                                    >
                                      <LuUserCog className="mr-2 h-4 w-4" aria-hidden />
                                      Role
                                    </button>
                                    {canDeactivateThisMember && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionsId(null);
                                          if (member.deactivated) {
                                            handleActivateClick(member.id);
                                          } else {
                                            handleDeactivateClick(member.id);
                                          }
                                        }}
                                        disabled={loading}
                                        className={`inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium transition disabled:opacity-50 ${
                                          member.deactivated
                                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                            : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                                        }`}
                                      >
                                        <LuPower className="mr-2 h-4 w-4" aria-hidden />
                                        {member.deactivated
                                          ? "Activate"
                                          : "Deactivate"}
                                      </button>
                                    )}
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setOpenActionsId(
                                            openActionsId === member.id
                                              ? null
                                              : member.id
                                          )
                                        }
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                                        aria-label="More actions"
                                        aria-expanded={openActionsId === member.id}
                                      >
                                        <LuEllipsis className="h-4 w-4" aria-hidden />
                                      </button>
                                      {openActionsId === member.id && (
                                        <div
                                          className="absolute right-0 top-12 z-20 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
                                          role="menu"
                                        >
                                          <button
                                            type="button"
                                            role="menuitem"
                                            className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                            onClick={() => {
                                              setOpenActionsId(null);
                                              handleEditMember(member);
                                            }}
                                          >
                                            <LuPencil className="mr-2 h-4 w-4" aria-hidden />
                                            Edit profile
                                          </button>
                                          <button
                                            type="button"
                                            role="menuitem"
                                            className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                            onClick={() => {
                                              setOpenActionsId(null);
                                              handleEditMember(member);
                                            }}
                                          >
                                            <LuUserCog className="mr-2 h-4 w-4" aria-hidden />
                                            Manage role
                                          </button>
                                          {canDeactivateThisMember && (
                                            <button
                                              type="button"
                                              role="menuitem"
                                              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                              onClick={() => {
                                                setOpenActionsId(null);
                                                if (member.deactivated) {
                                                  handleActivateClick(member.id);
                                                } else {
                                                  handleDeactivateClick(member.id);
                                                }
                                              }}
                                            >
                                              <LuPower className="mr-2 h-4 w-4" aria-hidden />
                                              {member.deactivated
                                                ? "Activate member"
                                                : "Deactivate member"}
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

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
                    Phone number
                  </label>
                  <input
                    type="tel"
                    value={memberFormData.phone}
                    onChange={(e) =>
                      setMemberFormData({ ...memberFormData, phone: e.target.value })
                    }
                    placeholder="e.g., +1 (555) 000-0000"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                    autoComplete="tel"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">
                    {editingMember?.is_workspace_owner ? 'Primary role' : 'Role'} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={memberFormData.role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      // Remove the newly-selected primary from additional_roles to
                      // avoid duplicates, then clear departments only when
                      // service_provider is absent from both the primary and the
                      // remaining additional roles.
                      const nextAdditional = memberFormData.additional_roles.filter(r => r !== newRole);
                      const stillServiceProvider =
                        newRole === ROLE_SERVICE_PROVIDER || nextAdditional.includes(ROLE_SERVICE_PROVIDER);
                      setMemberFormData({
                        ...memberFormData,
                        role: newRole,
                        additional_roles: nextAdditional,
                        departments: stillServiceProvider ? memberFormData.departments : [],
                      });
                    }}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                    required
                  >
                    {ASSIGNABLE_ROLES.filter(r =>
                      editingMember?.is_workspace_owner
                        ? !OWNER_DISALLOWED_ROLES.includes(r.value)
                        : true
                    ).map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    {editingMember?.is_workspace_owner
                      ? 'Owner can hold multiple roles. Pick the primary role below, then add any additional roles.'
                      : 'Select the role for this team member'}
                  </p>
                </div>

                {editingMember?.is_workspace_owner && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-700">
                      Additional roles
                    </label>
                    <div className="border border-slate-300 rounded-lg p-3">
                      <div className="space-y-2">
                        {ASSIGNABLE_ROLES.filter(r =>
                          r.value !== memberFormData.role &&
                          !OWNER_DISALLOWED_ROLES.includes(r.value)
                        ).map((r) => {
                          const checked = memberFormData.additional_roles.includes(r.value);
                          return (
                            <button
                              key={r.value}
                              type="button"
                              onClick={() => toggleAdditionalRole(r.value)}
                              className={`w-full text-left px-3 py-2 rounded-md text-sm transition ${
                                checked
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {checked ? (
                                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                )}
                                {r.label}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Owner retains full workspace privileges regardless of these selections.</p>
                  </div>
                )}

                {/* Departments Selector - Show when service_provider is the
                    primary role OR present in additional roles (owner case) */}
                {(memberFormData.role === ROLE_SERVICE_PROVIDER ||
                  memberFormData.additional_roles.includes(ROLE_SERVICE_PROVIDER)) && (
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
                          departments: newRole === ROLE_SERVICE_PROVIDER ? inviteFormData.departments : [],
                        });
                      }}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                      required
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">Select the role for this team member</p>
                  </div>

                  {/* Departments Selector - Only show for service_provider role */}
                  {inviteFormData.role === ROLE_SERVICE_PROVIDER && (
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
    </div>
  );
}

