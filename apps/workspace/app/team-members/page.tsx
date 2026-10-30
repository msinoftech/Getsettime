"use client";
import { getWorkspaceSession } from '@/src/lib/auth_session';
import { useState, useEffect, useMemo, useCallback } from "react";
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
import {
  EditTeamMemberModal,
  ManageRoleModal,
  ProviderCreateModal,
  StaffInviteModal,
} from "./team-member-modals";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/src/providers/AuthProvider";
import { useWorkspaceSettings } from "@/src/hooks/useWorkspaceSettings";
import { ConfirmModal } from "@/src/components/ui/ConfirmModal";
import { toast } from "@/src/components/ui/toast";
import { UpgradePlanModal } from "@/src/components/Subscription/UpgradePlanModal";
import {
  useSubscription,
  type SubscriptionApiResponse,
} from "@/src/hooks/useSubscription";
import {
  StatValueSkeleton,
  TeamMemberCardsSkeleton,
} from "@/src/components/ui/TeamMemberSkeleton";
import {
  ROLE_MANAGER,
  ROLE_SERVICE_PROVIDER,
  ROLE_WORKSPACE_ADMIN,
  SERVICE_PROVIDER_ASSIGNABLE_ADDITIONAL_ROLES,
  formatRoleLabel,
} from "@/src/constants/roles";
import { splitDepartmentSelectionByName } from "@/lib/invite_department_assignment";
import { userActsAsServiceProviderFromMetadata } from "@/lib/service_provider_role";
import ScreenGate from "@/src/components/ScreenGate";
import { useWorkspaceUsers } from "@/src/providers/WorkspaceUsersProvider";
import { WorkspaceUserAvatar } from "@/src/components/User/WorkspaceUserAvatar";

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
  onboarding_completed?: boolean | null;
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

/** Active = not deactivated; excludes `excludeUserId` from the roster. */
function countOtherActiveServiceProviders(
  members: TeamMember[],
  excludeUserId: string
): number {
  return members.filter(
    (m) =>
      m.id !== excludeUserId &&
      !m.deactivated &&
      teamMemberActsAsServiceProvider(m)
  ).length;
}

function isServiceProviderPlanLimitReached(
  subscription: SubscriptionApiResponse | null
): boolean {
  if (!subscription) return false;
  return (
    subscription.usage.service_provider_count >=
    subscription.usage.service_provider_limit
  );
}

function getServiceProviderLimitUpgradeMessage(
  subscription: SubscriptionApiResponse
): string {
  const { service_provider_limit, service_provider_count } = subscription.usage;
  return `Your ${subscription.plan.name} plan allows up to ${service_provider_limit} service providers, and you already have ${service_provider_count}. Upgrade your plan or contact your administrator to add more.`;
}

function isAdminPlanLimitReached(
  subscription: SubscriptionApiResponse | null
): boolean {
  if (!subscription) return false;
  return subscription.usage.admin_count >= subscription.usage.admin_limit;
}

function getAdminLimitUpgradeMessage(
  subscription: SubscriptionApiResponse
): string {
  const { admin_limit, admin_count } = subscription.usage;
  return `Your ${subscription.plan.name} plan allows up to ${admin_limit} workspace admin${admin_limit === 1 ? "" : "s"}, and you already have ${admin_count} assigned or pending. Upgrade your plan to add more.`;
}

function teamMemberHasWorkspaceAdminAccess(member: TeamMember): boolean {
  if (member.deactivated) return false;
  if (member.role === ROLE_WORKSPACE_ADMIN) return true;
  return (member.additional_roles ?? []).includes(ROLE_WORKSPACE_ADMIN);
}

function memberWouldGainWorkspaceAdminAccess(
  member: TeamMember,
  formRole: string,
  formAdditionalRoles: string[]
): boolean {
  if (teamMemberHasWorkspaceAdminAccess(member)) return false;
  if (formRole === ROLE_WORKSPACE_ADMIN) return true;
  return formAdditionalRoles.includes(ROLE_WORKSPACE_ADMIN);
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
  if (teamMemberActsAsServiceProvider(m)) {
    if (m.onboarding_completed === false) return "onboarding";
    if (
      m.onboarding_completed == null &&
      getSortedDepartmentIdsForDisplay(m, depts).length === 0
    ) {
      return "onboarding";
    }
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

export default function TeamMembersPage() {
  const { user: currentUser } = useAuth();
  const {
    workspaceProfessionLabel,
    workspaceAdminProfessionsId,
  } = useWorkspaceSettings();
  const currentUserRole =
    (currentUser?.user_metadata?.role as string | undefined) ?? null;
  const currentUserIsOwner =
    currentUser?.user_metadata?.is_workspace_owner === true;
  const canAssignServiceProviderAdditionalRoles =
    currentUserIsOwner || currentUserRole === ROLE_WORKSPACE_ADMIN;
  // Only workspace owner or workspace admin may edit team members and change roles.
  const canManageMembers =
    currentUserIsOwner || currentUserRole === ROLE_WORKSPACE_ADMIN;

  const { data: subscription } = useSubscription(Boolean(currentUser));
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeModalMessage, setUpgradeModalMessage] = useState(
    "Upgrade your plan to add more service providers."
  );

  const {
    members: workspaceMembers,
    loading: workspaceMembersLoading,
    refresh: refreshWorkspaceMembers,
  } = useWorkspaceUsers();
  const teamMembers = workspaceMembers as TeamMember[];
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
    name: "",
    email: "",
    phone: "",
    role: ROLE_MANAGER,
    departments: [] as number[],
  });
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [providerCatalogNames, setProviderCatalogNames] = useState<string[]>([]);
  const [providerSelectedDepartmentNames, setProviderSelectedDepartmentNames] = useState<string[]>([]);
  const [providerInviteUrl, setProviderInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const initialLoading = workspaceMembersLoading;
  const [confirmModal, setConfirmModal] = useState<{
    action: "deactivate" | "activate";
    memberId: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [roleModalMember, setRoleModalMember] = useState<TeamMember | null>(null);

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
      const deptNames = teamMemberActsAsServiceProvider(m)
        ? getSortedDepartmentIdsForDisplay(m, departments)
            .map((id) => departments.find((d) => d.id === id)?.name)
            .filter(Boolean)
            .join(" ")
        : "";
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
    fetchDepartments();
  }, []);

  useEffect(() => {
    setOpenActionsId(null);
  }, [search, statusFilter, teamMembers]);

  const showProviderLimitUpgrade = useCallback((): boolean => {
    if (!isServiceProviderPlanLimitReached(subscription)) return false;
    setUpgradeModalMessage(
      subscription
        ? getServiceProviderLimitUpgradeMessage(subscription)
        : "Upgrade your plan to add more service providers."
    );
    setUpgradeModalOpen(true);
    return true;
  }, [subscription]);

  const showAdminLimitUpgrade = useCallback((): boolean => {
    if (!isAdminPlanLimitReached(subscription)) return false;
    setUpgradeModalMessage(
      subscription
        ? getAdminLimitUpgradeMessage(subscription)
        : "Upgrade your plan to add more workspace admins."
    );
    setUpgradeModalOpen(true);
    return true;
  }, [subscription]);

  const handleInviteFormChange = useCallback(
    (data: typeof inviteFormData) => {
      if (
        data.role === ROLE_WORKSPACE_ADMIN &&
        inviteFormData.role !== ROLE_WORKSPACE_ADMIN &&
        showAdminLimitUpgrade()
      ) {
        return;
      }
      setInviteFormData(data);
    },
    [inviteFormData.role, showAdminLimitUpgrade]
  );

  const handleMemberFormChange = useCallback(
    (data: typeof memberFormData) => {
      const target = roleModalMember ?? editingMember;
      if (
        target &&
        data.role === ROLE_WORKSPACE_ADMIN &&
        memberFormData.role !== ROLE_WORKSPACE_ADMIN &&
        memberWouldGainWorkspaceAdminAccess(
          target,
          data.role,
          data.additional_roles
        ) &&
        showAdminLimitUpgrade()
      ) {
        return;
      }
      setMemberFormData(data);
    },
    [
      roleModalMember,
      editingMember,
      memberFormData.role,
      showAdminLimitUpgrade,
    ]
  );

  const fetchDepartments = async () => {
    try {
      const { session } = await getWorkspaceSession();
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

  const loadProviderCatalogDepartments = async () => {
    try {
      const { session } = await getWorkspaceSession();
      if (!session) return;

      const headers = { Authorization: `Bearer ${session.access_token}` };
      const catalogId = workspaceAdminProfessionsId;
      if (catalogId == null || !Number.isFinite(Number(catalogId))) {
        setProviderCatalogNames([]);
        return;
      }

      const catRes = await fetch(
        `/api/catalog/departments?profession_id=${encodeURIComponent(String(catalogId))}`,
        { headers }
      );
      if (catRes.ok) {
        const catBody = (await catRes.json()) as { departments?: string[] };
        setProviderCatalogNames(
          Array.isArray(catBody.departments) ? catBody.departments : []
        );
      }
    } catch (err) {
      console.error("Error loading provider catalog departments:", err);
    }
  };

  const handleNewMember = () => {
    if (showProviderLimitUpgrade()) return;

    setRoleModalMember(null);
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
    setProviderSelectedDepartmentNames([]);
    setProviderInviteUrl(null);
    setShowInviteForm(false);
    setShowMemberForm(true);
    void loadProviderCatalogDepartments();
  };

  const handleInviteMember = () => {
    setRoleModalMember(null);
    setInviteFormData({
      name: "",
      email: "",
      phone: "",
      role: ROLE_MANAGER,
      departments: [],
    });
    setInviteUrl(null);
    setShowMemberForm(false);
    setShowInviteForm(true);
  };

  const handleOpenManageRole = (member: TeamMember) => {
    setRoleModalMember(member);
    setEditingMember(null);
    setShowMemberForm(false);
    setMemberFormData({
      name: member.name,
      email: member.email,
      phone: member.phone ?? "",
      password: "",
      role: member.role || ROLE_SERVICE_PROVIDER,
      additional_roles: member.additional_roles ?? [],
      departments: [...new Set(member.departments ?? [])],
    });
  };

  const handleRoleModalCancel = () => {
    setRoleModalMember(null);
    setMemberFormData({
      name: "",
      email: "",
      phone: "",
      password: "",
      role: ROLE_SERVICE_PROVIDER,
      additional_roles: [],
      departments: [],
    });
  };

  const handleEditMember = (member: TeamMember) => {
    setRoleModalMember(null);
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
    setShowMemberForm(true);
  };

  const handleMemberFormCancel = () => {
    setRoleModalMember(null);
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
    setProviderSelectedDepartmentNames([]);
    setProviderInviteUrl(null);
  };

  const toggleProviderDepartmentName = (name: string) => {
    setProviderSelectedDepartmentNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleProviderInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { session } = await getWorkspaceSession();
      if (!session) {
        toast.error("Not authenticated");
        setLoading(false);
        return;
      }

      const { departmentIds, departmentNames } = splitDepartmentSelectionByName(
        providerSelectedDepartmentNames,
        departments
      );

      if (departmentIds.length === 0 && departmentNames.length === 0) {
        toast.error("Select at least one department");
        setLoading(false);
        return;
      }

      if (showProviderLimitUpgrade()) {
        setLoading(false);
        return;
      }

      const response = await fetch("/api/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: memberFormData.email,
          role: ROLE_SERVICE_PROVIDER,
          name: memberFormData.name.trim(),
          phone: memberFormData.phone.trim(),
          departments: departmentIds,
          department_names: departmentNames,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success("Provider invite sent successfully.");
        setProviderInviteUrl(data.inviteUrl);
        await refreshWorkspaceMembers();
      } else {
        const errorData = (await response.json()) as {
          error?: string;
          upgradeRequired?: boolean;
        };
        if (errorData.upgradeRequired) {
          setUpgradeModalMessage(
            errorData.error || "Upgrade your plan to add more service providers."
          );
          setUpgradeModalOpen(true);
        } else {
          toast.error(errorData.error || "Failed to send provider invite");
        }
      }
    } catch (err) {
      console.error("Error sending provider invite:", err);
      toast.error("An error occurred while sending the provider invite");
    } finally {
      setLoading(false);
    }
  };

  const handleInviteFormCancel = () => {
    setShowInviteForm(false);
    setRoleModalMember(null);
    setInviteFormData({
      name: "",
      email: "",
      phone: "",
      role: ROLE_MANAGER,
      departments: [],
    });
    setInviteUrl(null);
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
    const formTarget = roleModalMember ?? editingMember;
    if (!formTarget) return;

    const isAdding = !memberFormData.additional_roles.includes(role);

    if (
      !isAdding &&
      role === ROLE_SERVICE_PROVIDER &&
      formTarget.is_workspace_owner &&
      formTarget.role === ROLE_WORKSPACE_ADMIN
    ) {
      if (countOtherActiveServiceProviders(teamMembers, formTarget.id) < 1) {
        return;
      }
    }

    if (
      isAdding &&
      role === ROLE_SERVICE_PROVIDER &&
      formTarget.is_workspace_owner &&
      !teamMemberActsAsServiceProvider(formTarget) &&
      isServiceProviderPlanLimitReached(subscription)
    ) {
      setUpgradeModalMessage(
        subscription
          ? getServiceProviderLimitUpgradeMessage(subscription)
          : "Upgrade your plan to add more service providers."
      );
      setUpgradeModalOpen(true);
      return;
    }

    if (
      isAdding &&
      role === ROLE_WORKSPACE_ADMIN &&
      !teamMemberHasWorkspaceAdminAccess(formTarget) &&
      isAdminPlanLimitReached(subscription)
    ) {
      showAdminLimitUpgrade();
      return;
    }

    setMemberFormData((prev) => {
      const additional_roles = prev.additional_roles.includes(role)
        ? prev.additional_roles.filter((r) => r !== role)
        : [...prev.additional_roles, role];
      return {
        ...prev,
        additional_roles,
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

    try {
      const { session } = await getWorkspaceSession();
      if (!session) {
        toast.error("Not authenticated");
        setLoading(false);
        return;
      }

      const targetMember = roleModalMember ?? editingMember;
      if (!targetMember) {
        setLoading(false);
        return;
      }

      const fromRoleModal = roleModalMember !== null;

      const url = '/api/team-members';
      const method = 'PUT';
      const additionalRolesPayload = (() => {
        if (targetMember.is_workspace_owner) {
          return memberFormData.additional_roles.filter((r) => r !== memberFormData.role);
        }
        if (
          canAssignServiceProviderAdditionalRoles &&
          !targetMember.is_workspace_owner &&
          targetMember.role === ROLE_SERVICE_PROVIDER
        ) {
          const allowed = new Set(SERVICE_PROVIDER_ASSIGNABLE_ADDITIONAL_ROLES);
          return memberFormData.additional_roles.filter((r) => allowed.has(r));
        }
        return undefined;
      })();

      const actsAsServiceProviderInForm =
        userActsAsServiceProviderFromMetadata({
          role: memberFormData.role,
          is_workspace_owner: targetMember.is_workspace_owner,
          additional_roles: memberFormData.additional_roles,
        });

      const targetCurrentlyActsAsServiceProvider =
        teamMemberActsAsServiceProvider(targetMember);

      if (
        !targetCurrentlyActsAsServiceProvider &&
        actsAsServiceProviderInForm &&
        isServiceProviderPlanLimitReached(subscription)
      ) {
        setUpgradeModalMessage(
          subscription
            ? getServiceProviderLimitUpgradeMessage(subscription)
            : "Upgrade your plan to add more service providers."
        );
        setUpgradeModalOpen(true);
        setLoading(false);
        return;
      }

      if (
        memberWouldGainWorkspaceAdminAccess(
          targetMember,
          memberFormData.role,
          memberFormData.additional_roles
        ) &&
        showAdminLimitUpgrade()
      ) {
        setLoading(false);
        return;
      }

      const body = {
        id: targetMember.id,
        name: memberFormData.name,
        email: memberFormData.email,
        phone: memberFormData.phone,
        role: memberFormData.role,
        ...(actsAsServiceProviderInForm
          ? { departments: memberFormData.departments }
          : {}),
        ...(additionalRolesPayload !== undefined
          ? { additional_roles: additionalRolesPayload }
          : {}),
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
        toast.success("Team member updated successfully.");
        await refreshWorkspaceMembers();
        if (fromRoleModal) handleRoleModalCancel();
        else handleMemberFormCancel();
      } else {
        const errorData = (await response.json()) as {
          error?: string;
          upgradeRequired?: boolean;
        };
        if (errorData.upgradeRequired) {
          setUpgradeModalMessage(
            errorData.error || "Upgrade your plan to add more service providers."
          );
          setUpgradeModalOpen(true);
        } else {
          toast.error(errorData.error || "Failed to update team member");
        }
      }
    } catch (error) {
      console.error('Error saving team member:', error);
      toast.error("An error occurred while saving the team member");
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

    try {
      const { session } = await getWorkspaceSession();
      if (!session) {
        toast.error("Not authenticated");
        setConfirmModal(null);
        setLoading(false);
        return;
      }

      const isDeactivate = confirmModal.action === "deactivate";
      const deactivatedMember = teamMembers.find(
        (m) => m.id === confirmModal.memberId
      );
      const response = await fetch(`/api/team-members?id=${confirmModal.memberId}`, {
        method: isDeactivate ? 'DELETE' : 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        toast.success(
          isDeactivate
            ? deactivatedMember
              ? `"${deactivatedMember.name}" deactivated successfully.`
              : "Team member deactivated successfully."
            : deactivatedMember
              ? `"${deactivatedMember.name}" activated successfully.`
              : "Team member activated successfully."
        );
        await refreshWorkspaceMembers();
        setConfirmModal(null);
      } else {
        const errorData = await response.json();
        toast.error(
          errorData.error ||
            (isDeactivate ? "Failed to deactivate team member" : "Failed to activate team member")
        );
        setConfirmModal(null);
      }
    } catch (err) {
      const isDeactivate = confirmModal.action === "deactivate";
      console.error(isDeactivate ? 'Error deactivating team member:' : 'Error activating team member:', err);
      toast.error(
        confirmModal.action === "deactivate"
          ? "An error occurred while deactivating the team member"
          : "An error occurred while activating the team member"
      );
      setConfirmModal(null);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { session } = await getWorkspaceSession();
      if (!session) {
        toast.error("Not authenticated");
        setLoading(false);
        return;
      }

      if (
        inviteFormData.role === ROLE_WORKSPACE_ADMIN &&
        showAdminLimitUpgrade()
      ) {
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
          name: inviteFormData.name.trim(),
          phone: inviteFormData.phone.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success("Invite created successfully.");
        setInviteUrl(data.inviteUrl);
      } else {
        const errorData = (await response.json()) as {
          error?: string;
          upgradeRequired?: boolean;
        };
        if (errorData.upgradeRequired) {
          setUpgradeModalMessage(
            errorData.error || "Upgrade your plan to add more workspace admins."
          );
          setUpgradeModalOpen(true);
        } else {
          toast.error(errorData.error || "Failed to create invite");
        }
      }
    } catch (error) {
      console.error('Error creating invite:', error);
      toast.error("An error occurred while creating the invite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
        <div className="mx-auto">
          <section className="relative space-y-4">
            <div className="rounded-2xl overflow-hidden shadow-lg bg-gradient-to-r from-sky-50 via-white to-indigo-50 p-4 md:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  {/* <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white/80 px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm backdrop-blur">
                    <LuUsers className="h-4 w-4" aria-hidden />
                    Team Access Management
                  </div> */}
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                      Team Members
                    </h1>
                    <p className="max-w-2xl text-sm text-slate-600">
                      Manage team access, invite staff, onboard providers, and control roles with full action history.
                    </p>
                  </div>
                </div>
                {canManageMembers && (
                  <div className="flex gap-3 lg:justify-end flex-row flex-wrap">
                    <button
                      type="button"
                      onClick={handleInviteMember}
                      className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-600 shadow-none transition hover:bg-emerald-100"
                    >
                      <LuMail className="mr-2 h-4 w-4" aria-hidden />
                      Invite Staff / Manager
                    </button>
                    <button
                      type="button"
                      onClick={handleNewMember}
                      className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                    >
                      <LuUserPlus className="mr-2 h-4 w-4" aria-hidden />
                      Add Service Provider
                    </button>
                  </div>
                )}
              </div>
              
              <ScreenGate minWidth={1024}>
              <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
                {(
                  [
                    ["Total Members", teamStats.total, LuUsers, "bg-indigo-50 text-indigo-600"],
                    ["Active Members", teamStats.active, LuBadgeCheck, "bg-emerald-50 text-emerald-600"],
                    ["Pending Invites", teamStats.invited, LuStar, "bg-violet-50 text-violet-600"],
                    ["Provider Onboarding", teamStats.onboarding, LuStethoscope, "bg-amber-50 text-amber-600"],
                    ["Service Providers", teamStats.providers, LuBriefcase, "bg-sky-50 text-sky-600"],
                  ] as const
                ).map(([label, value, StatIcon, iconClass]) => (
                  <div key={String(label)} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className={`flex h-10 w-10 xl:h-14 xl:w-14 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
                        <StatIcon className="h-4 w-4 md:h-5 md:w-5" aria-hidden />
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-snug text-slate-500">{label}</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {initialLoading ? <StatValueSkeleton /> : value}
                        </p>
                      </div>
                  </div>
                ))}
              </div>
              </ScreenGate>

            </div>

            <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
              <div className="mb-5 flex w-full min-w-0 flex-col gap-3 min-[900px]:flex-row lg:flex-col xl:flex-row min-[900px]:items-center lg:items-start sm:gap-3">
                <div className="relative w-full">
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-slate-400"
                    aria-hidden
                  >
                    <LuSearch className="h-4 w-4 shrink-0" />
                  </div>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by member name, email, role, department, or status..."
                    className="box-border w-full h-12 rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-normal leading-normal text-slate-900 shadow-none outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div className="flex w-full shrink-0 max-[592px]:pb-3 flex-nowrap justify-start gap-2 overflow-x-auto overflow-y-hidden [scrollbar-gutter:stable] sm:w-auto sm:pb-0">
                  {STATUS_FILTER_CHIPS.map((chip) => {
                    const isActive = statusFilter === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setStatusFilter(chip.id)}
                        className={`inline-flex h-12 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 text-sm font-medium transition ${
                          isActive
                            ? "bg-indigo-600 text-white shadow-sm"
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

              {initialLoading ? (
                <TeamMemberCardsSkeleton showActions={canManageMembers} />
              ) : teamMembers.length === 0 ? (
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
                        className={`group rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)] ${
                          member.deactivated ? "opacity-70" : ""
                        }`}
                      >
                        <div className="p-4 md:p-6">
                          <div className="flex gap-5 flex-row xl:items-start xl:justify-between">
                            <div className="flex flex-1 gap-3">
                              <WorkspaceUserAvatar
                                userId={member.id}
                                name={member.name}
                                email={member.email}
                                size="lg"
                                shape="rounded"
                                className="h-8 w-8 sm:h-11 sm:w-11 bg-indigo-500 text-white shadow-sm"
                              />
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
                                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
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

                                  <ScreenGate minWidth={768}>
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
                                  </ScreenGate>
                                  
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                  {member.role && (
                                    <span
                                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getRolePillClass(member.role)}`}
                                    >
                                      {formatRoleLabel(member.role)}
                                    </span>
                                  )}
                                  {[...new Set((member.additional_roles ?? []).filter((r) => r && r !== member.role))].map(
                                    (r) => (
                                      <span
                                        key={r}
                                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getRolePillClass(r)}`}
                                      >
                                        {formatRoleLabel(r)}
                                      </span>
                                    ),
                                  )}
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
                                
                                <ScreenGate minWidth={640}>
                                {teamMemberActsAsServiceProvider(member) &&
                                  displayDeptIds.length > 0 && (
                                  <div className="mt-2 flex max-h-48 flex-wrap gap-2 overflow-y-auto pr-1">
                                    {displayDeptIds.map((deptId) => {
                                      const name = departments.find(
                                        (d) => d.id === deptId
                                      )?.name;
                                      if (!name) return null;
                                      return (
                                        <span
                                          key={deptId}
                                          className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                                        >
                                          {name}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                </ScreenGate>

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
                                  <ScreenGate minWidth={1280}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionsId(null);
                                        handleEditMember(member);
                                      }}
                                      disabled={loading || member.deactivated}
                                      className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 cursor-pointer"
                                    >
                                      <LuPencil className="mr-2 h-4 w-4" aria-hidden />
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionsId(null);
                                        handleOpenManageRole(member);
                                      }}
                                      disabled={loading || member.deactivated}
                                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 cursor-pointer"
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
                                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition cursor-pointer ${
                                          member.deactivated
                                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                                            : "bg-red-50 text-red-700 hover:bg-red-100 border-red-200"
                                        }`}
                                      >
                                        <LuPower className="mr-2 h-4 w-4" aria-hidden />
                                        {member.deactivated
                                          ? "Activate"
                                          : "Deactivate"}
                                      </button>
                                    )}
                                    </ScreenGate>

                                    <ScreenGate maxWidth={1279}>
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
                                        className="inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                                        aria-label="More actions"
                                        aria-expanded={openActionsId === member.id}
                                      >
                                        <LuEllipsis className="h-4 w-4" aria-hidden />
                                      </button>
                                      {openActionsId === member.id && (
                                        <div
                                          className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
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
                                              handleOpenManageRole(member);
                                            }}
                                          >
                                            <LuUserCog className="mr-2 h-4 w-4" aria-hidden />
                                            Manage role
                                          </button>
                                          {canDeactivateThisMember && (
                                            <button
                                              type="button"
                                              role="menuitem"
                                              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
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
                                    </ScreenGate>

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

      <ProviderCreateModal
        open={showMemberForm && !editingMember}
        loading={loading}
        professionLabel={workspaceProfessionLabel ?? null}
        catalogDepartmentNames={providerCatalogNames}
        selectedDepartmentNames={providerSelectedDepartmentNames}
        memberFormData={memberFormData}
        inviteUrl={providerInviteUrl}
        onCancel={handleMemberFormCancel}
        onSubmit={handleProviderInviteSubmit}
        onChange={setMemberFormData}
        onToggleDepartmentName={toggleProviderDepartmentName}
      />

      <EditTeamMemberModal
        open={showMemberForm && editingMember !== null}
        loading={loading}
        editingMember={editingMember!}
        departments={departments}
        memberFormData={memberFormData}
        statusLabel={
          editingMember
            ? getStatusLabel(getMemberUiStatus(editingMember, departments))
            : ""
        }
        canAssignServiceProviderAdditionalRoles={canAssignServiceProviderAdditionalRoles}
        otherActiveServiceProviderCount={
          editingMember
            ? countOtherActiveServiceProviders(teamMembers, editingMember.id)
            : 0
        }
        serviceProviderLimitReached={isServiceProviderPlanLimitReached(subscription)}
        serviceProviderLimitMessage={
          subscription
            ? getServiceProviderLimitUpgradeMessage(subscription)
            : "Upgrade your plan to add more service providers."
        }
        targetActsAsServiceProvider={
          editingMember ? teamMemberActsAsServiceProvider(editingMember) : false
        }
        onCancel={handleMemberFormCancel}
        onSubmit={handleMemberFormSubmit}
        onChange={handleMemberFormChange}
        onToggleDepartment={toggleDepartment}
        onToggleAdditionalRole={toggleAdditionalRole}
      />

      {roleModalMember ? (
        <ManageRoleModal
          open
          loading={loading}
          member={roleModalMember}
          departments={departments}
          memberFormData={memberFormData}
          canAssignServiceProviderAdditionalRoles={canAssignServiceProviderAdditionalRoles}
          otherActiveServiceProviderCount={countOtherActiveServiceProviders(
            teamMembers,
            roleModalMember.id
          )}
          serviceProviderLimitReached={isServiceProviderPlanLimitReached(subscription)}
          serviceProviderLimitMessage={
            subscription
              ? getServiceProviderLimitUpgradeMessage(subscription)
              : "Upgrade your plan to add more service providers."
          }
          targetActsAsServiceProvider={teamMemberActsAsServiceProvider(
            roleModalMember
          )}
          onCancel={handleRoleModalCancel}
          onSubmit={handleMemberFormSubmit}
          onChange={handleMemberFormChange}
          onToggleDepartment={toggleDepartment}
          onToggleAdditionalRole={toggleAdditionalRole}
        />
      ) : null}

      <StaffInviteModal
        open={showInviteForm}
        loading={loading}
        departments={departments}
        inviteFormData={inviteFormData}
        inviteUrl={inviteUrl}
        onCancel={handleInviteFormCancel}
        onSubmit={handleInviteFormSubmit}
        onChange={handleInviteFormChange}
        onToggleDepartment={toggleInviteDepartment}
      />

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

      <UpgradePlanModal
        open={upgradeModalOpen}
        message={upgradeModalMessage}
        onClose={() => setUpgradeModalOpen(false)}
      />
    </div>
  );
}

