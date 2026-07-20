"use client";

import { useState } from "react";
import {
  LuBuilding2,
  LuPencil,
  LuSend,
  LuStethoscope,
  LuUserCog,
  LuX,
} from "react-icons/lu";
import {
  ASSIGNABLE_ROLES,
  OWNER_DISALLOWED_ROLES,
  ROLE_CUSTOMER,
  ROLE_MANAGER,
  ROLE_SERVICE_PROVIDER,
  ROLE_STAFF,
  ROLE_WORKSPACE_ADMIN,
  SERVICE_PROVIDER_ASSIGNABLE_ADDITIONAL_ROLES,
} from "@/src/constants/roles";

const STAFF_INVITE_ROLES = ASSIGNABLE_ROLES.filter(
  (r) => r.value !== ROLE_SERVICE_PROVIDER && r.value !== ROLE_CUSTOMER
);

export const MODAL_FIELD_CLASS =
  "w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 shadow-none outline-none transition focus:border-transparent focus:ring-2 focus:ring-slate-200";

function ModalErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
      <div className="flex items-start gap-2">
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-sm text-red-800">{error}</p>
      </div>
    </div>
  );
}

function ModalSuccessBanner({ success }: { success: string | null }) {
  if (!success) return null;

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-3">
      <div className="flex items-start gap-2">
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-sm text-green-800">{success}</p>
      </div>
    </div>
  );
}

function InviteLinkCopyBlock({
  inviteUrl,
  variant,
}: {
  inviteUrl: string;
  variant: "sky" | "emerald";
}) {
  const [copied, setCopied] = useState(false);
  const copyBtnClass =
    variant === "sky"
      ? "bg-sky-600 hover:bg-sky-700"
      : "bg-emerald-600 hover:bg-emerald-700";
  const copiedBannerClass =
    variant === "sky"
      ? "border-sky-200 bg-sky-50 text-sky-900"
      : "border-emerald-200 bg-emerald-50 text-emerald-900";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div>
      {copied ? (
        <p
          className={`mb-3 rounded-lg border px-3 py-2 text-sm font-medium ${copiedBannerClass}`}
          role="status"
        >
          Link copied to clipboard!
        </p>
      ) : null}
      <label className="mb-2 block text-sm font-medium text-slate-700">Invite link</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={inviteUrl}
          readOnly
          className={`${MODAL_FIELD_CLASS} bg-slate-50`}
        />
        <button
          type="button"
          onClick={() => void handleCopy()}
          className={`inline-flex h-11 shrink-0 items-center rounded-xl px-4 text-sm font-medium text-white ${copyBtnClass}`}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        This link expires in 72 hours and can only be used once.
      </p>
    </div>
  );
}

type Department = {
  id: number;
  name: string;
};

type DepartmentChipVariant = "staff" | "provider" | "manage";

export function CatalogDepartmentChipSelector({
  catalogNames,
  selectedNames,
  onToggleName,
  variant,
  emptyMessage,
}: {
  catalogNames: string[];
  selectedNames: string[];
  onToggleName: (name: string) => void;
  variant: DepartmentChipVariant;
  emptyMessage: string;
}) {
  if (catalogNames.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  const selectedClass =
    variant === "staff"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
      : variant === "provider"
        ? "border-sky-300 bg-sky-50 text-sky-800 ring-1 ring-sky-200"
        : "border-indigo-300 bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200";

  const unselectedClass =
    "border-slate-200 bg-white text-slate-700 hover:border-slate-300";

  return (
    <div className="flex flex-wrap gap-2">
      {catalogNames.map((name) => {
        const selected = selectedNames.includes(name);
        return (
          <button
            key={name}
            type="button"
            onClick={() => onToggleName(name)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              selected ? selectedClass : unselectedClass
            }`}
          >
            <LuBuilding2 className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            {name}
          </button>
        );
      })}
    </div>
  );
}

export function DepartmentChipSelector({
  departments,
  selectedIds,
  onToggle,
  variant,
  emptyMessage,
}: {
  departments: Department[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  variant: DepartmentChipVariant;
  emptyMessage: string;
}) {
  if (departments.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  const selectedClass =
    variant === "staff"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
      : variant === "provider"
        ? "border-sky-300 bg-sky-50 text-sky-800 ring-1 ring-sky-200"
        : "border-indigo-300 bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200";

  const unselectedClass =
    "border-slate-200 bg-white text-slate-700 hover:border-slate-300";

  return (
    <div className="flex flex-wrap gap-2">
      {departments.map((department) => {
        const selected = selectedIds.includes(department.id);
        return (
          <button
            key={department.id}
            type="button"
            onClick={() => onToggle(department.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              selected ? selectedClass : unselectedClass
            }`}
          >
            <LuBuilding2 className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            {department.name}
          </button>
        );
      })}
    </div>
  );
}

const SP_ASSIGNABLE_ROLE_OPTIONS = ASSIGNABLE_ROLES.filter((r) =>
  (SERVICE_PROVIDER_ASSIGNABLE_ADDITIONAL_ROLES as readonly string[]).includes(r.value),
);

function getEditablePrimaryRoleOptions(
  member: { is_workspace_owner: boolean; role: string | null }
) {
  let options = ASSIGNABLE_ROLES.filter((r) =>
    member.is_workspace_owner
      ? !OWNER_DISALLOWED_ROLES.includes(r.value)
      : true
  );

  if (member.role === ROLE_MANAGER && !member.is_workspace_owner) {
    options = options.filter(
      (r) =>
        r.value === ROLE_WORKSPACE_ADMIN ||
        r.value === ROLE_STAFF ||
        r.value === ROLE_MANAGER
    );
  }

  if (
    !member.is_workspace_owner &&
    member.role === ROLE_STAFF
  ) {
    options = options.filter((r) => r.value !== ROLE_CUSTOMER);
  }

  return options;
}

type TeamMember = {
  id: string;
  name: string;
  is_workspace_owner: boolean;
  role: string | null;
};

type MemberFormData = {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: string;
  additional_roles: string[];
  departments: number[];
};

type InviteFormData = {
  name: string;
  email: string;
  phone: string;
  role: string;
  departments: number[];
};

export function ProviderCreateModal({
  open,
  loading,
  error = null,
  professionLabel,
  catalogDepartmentNames,
  selectedDepartmentNames,
  memberFormData,
  inviteUrl,
  onCancel,
  onSubmit,
  onChange,
  onToggleDepartmentName,
}: {
  open: boolean;
  loading: boolean;
  error?: string | null;
  professionLabel: string | null;
  catalogDepartmentNames: string[];
  selectedDepartmentNames: string[];
  memberFormData: MemberFormData;
  inviteUrl: string | null;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (data: MemberFormData) => void;
  onToggleDepartmentName: (name: string) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden="true"
        onClick={onCancel}
      />
      <section className="relative z-10 flex max-h-[min(90vh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                <LuStethoscope className="h-3.5 w-3.5" aria-hidden />
                Provider Onboarding Flow
              </span>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
                  Add Service Provider
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Send an invite with assigned departments. The provider completes onboarding after
                  accepting the invite.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
              aria-label="Close form"
              onClick={onCancel}
            >
              <LuX className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {inviteUrl ? (
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                <p className="text-sm font-semibold text-sky-900">Provider invite sent</p>
                <p className="mt-1 text-xs text-sky-800">
                  Share this link with the service provider:
                </p>
              </div>
              <InviteLinkCopyBlock inviteUrl={inviteUrl} variant="sky" />
              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex h-11 items-center rounded-xl bg-sky-600 px-5 text-sm font-medium text-white hover:bg-sky-700"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <ModalErrorBanner error={error} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={memberFormData.name}
                  onChange={(e) => onChange({ ...memberFormData, name: e.target.value })}
                  placeholder="Enter provider name"
                  className={MODAL_FIELD_CLASS}
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={memberFormData.email}
                  onChange={(e) => onChange({ ...memberFormData, email: e.target.value })}
                  placeholder="Enter email address"
                  className={MODAL_FIELD_CLASS}
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Phone Number</label>
                <input
                  type="tel"
                  value={memberFormData.phone}
                  onChange={(e) => onChange({ ...memberFormData, phone: e.target.value })}
                  placeholder="Enter contact number"
                  className={MODAL_FIELD_CLASS}
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Role</label>
                <select
                  value={ROLE_SERVICE_PROVIDER}
                  disabled
                  className={`${MODAL_FIELD_CLASS} cursor-not-allowed bg-slate-50 text-slate-600`}
                >
                  <option value={ROLE_SERVICE_PROVIDER}>Service Provider</option>
                </select>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                  <LuStethoscope className="h-5 w-5 text-sky-600" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-slate-900">Department Assignment</h3>
                  {professionLabel ? (
                    <p className="mt-1 text-xs font-medium text-sky-800">
                      Profession: {professionLabel}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-600">
                    Departments for your workspace profession. Existing workspace departments are
                    linked on the invite; new ones are created when the provider completes onboarding
                    step 1.
                  </p>
                  <div className="mt-4">
                    <CatalogDepartmentChipSelector
                      catalogNames={catalogDepartmentNames}
                      selectedNames={selectedDepartmentNames}
                      onToggleName={onToggleDepartmentName}
                      variant="provider"
                      emptyMessage={
                        professionLabel
                          ? "No catalog departments for this profession."
                          : "Set workspace profession in onboarding to load department suggestions."
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading || selectedDepartmentNames.length === 0}
            >
              <LuSend className="mr-2 h-4 w-4" aria-hidden />
              {loading ? "Sending..." : "Send Provider Invite"}
            </button>
          </div>
        </form>
          )}
        </div>
      </section>
    </div>
  );
}

export function StaffInviteModal({
  open,
  loading,
  error = null,
  departments,
  inviteFormData,
  inviteUrl,
  onCancel,
  onSubmit,
  onChange,
  onToggleDepartment,
}: {
  open: boolean;
  loading: boolean;
  error?: string | null;
  departments: Department[];
  inviteFormData: InviteFormData;
  inviteUrl: string | null;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (data: InviteFormData) => void;
  onToggleDepartment: (id: number) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden="true"
        onClick={onCancel}
      />
      <section className="relative z-10 flex max-h-[min(90vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-3 pr-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                <LuSend className="h-3.5 w-3.5" aria-hidden />
                Staff & Manager Access
              </span>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
                  Invite Staff / Manager
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Invite internal team members. They can log in directly and manage based on their
                  assigned role.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
              aria-label="Close form"
              onClick={onCancel}
            >
              <LuX className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {inviteUrl ? (
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">Invite created successfully</p>
                <p className="mt-1 text-xs text-emerald-800">
                  Share this link with the team member:
                </p>
              </div>
              <InviteLinkCopyBlock inviteUrl={inviteUrl} variant="emerald" />
              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex h-11 items-center rounded-xl bg-emerald-600 px-5 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
                <ModalErrorBanner error={error} />
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
                  <p className="text-sm font-semibold text-emerald-900">Internal team invite flow</p>
                  <p className="mt-1 text-sm text-emerald-800">
                    Staff and managers get direct workspace access after accepting the invite. They
                    are not required to complete provider onboarding.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={inviteFormData.name}
                      onChange={(e) => onChange({ ...inviteFormData, name: e.target.value })}
                      placeholder="Enter staff or manager name"
                      className={MODAL_FIELD_CLASS}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Work Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={inviteFormData.email}
                      onChange={(e) => onChange({ ...inviteFormData, email: e.target.value })}
                      placeholder="Enter official work email"
                      className={MODAL_FIELD_CLASS}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Phone Number</label>
                    <input
                      type="tel"
                      value={inviteFormData.phone}
                      onChange={(e) => onChange({ ...inviteFormData, phone: e.target.value })}
                      placeholder="Enter contact number"
                      className={MODAL_FIELD_CLASS}
                      autoComplete="tel"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={inviteFormData.role}
                      onChange={(e) =>
                        onChange({ ...inviteFormData, role: e.target.value })
                      }
                      className={MODAL_FIELD_CLASS}
                      required
                    >
                      {STAFF_INVITE_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-900">Access Scope</h3>
                    <p className="mt-1 text-xs text-slate-600">
                      Select departments this staff member can view or manage inside the workspace.
                    </p>
                    <div className="mt-4">
                      <DepartmentChipSelector
                        departments={departments}
                        selectedIds={inviteFormData.departments}
                        onToggle={onToggleDepartment}
                        variant="staff"
                        emptyMessage="No departments available yet."
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-900">Login Behavior</h3>
                    <div className="mt-3 space-y-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                        <p className="text-xs font-semibold text-slate-900">Workspace Admin / Manager</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                          Can manage settings, team operations, and workspace controls based on
                          permission level.
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                        <p className="text-xs font-semibold text-slate-900">Staff / Receptionist</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                          Can log in with department-scoped access for day-to-day operations such as
                          bookings and front-desk workflows.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 px-6 py-4">
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex h-11 items-center rounded-xl bg-emerald-600 px-5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loading}
                >
                  <LuSend className="mr-2 h-4 w-4" aria-hidden />
                  {loading ? "Sending..." : "Send Staff Invite"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

export function EditTeamMemberModal({
  open,
  loading,
  success = null,
  editingMember,
  departments,
  memberFormData,
  statusLabel,
  canAssignServiceProviderAdditionalRoles,
  otherActiveServiceProviderCount,
  serviceProviderLimitReached,
  serviceProviderLimitMessage,
  targetActsAsServiceProvider,
  onCancel,
  onSubmit,
  onChange,
  onToggleDepartment,
  onToggleAdditionalRole,
}: {
  open: boolean;
  loading: boolean;
  success?: string | null;
  editingMember: TeamMember;
  departments: Department[];
  memberFormData: MemberFormData;
  statusLabel: string;
  canAssignServiceProviderAdditionalRoles: boolean;
  /** Excluding the edited user: members who are not deactivated and act as service provider. */
  otherActiveServiceProviderCount: number;
  serviceProviderLimitReached: boolean;
  serviceProviderLimitMessage: string;
  targetActsAsServiceProvider: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (data: MemberFormData) => void;
  onToggleDepartment: (id: number) => void;
  onToggleAdditionalRole: (role: string) => void;
}) {
  if (!open) return null;

  const lockSpPrimary =
    !editingMember.is_workspace_owner && editingMember.role === ROLE_SERVICE_PROVIDER;
  const lockWorkspaceAdminOwnerPrimary =
    editingMember.is_workspace_owner && editingMember.role === ROLE_WORKSPACE_ADMIN;
  const lockPrimaryRoleSelect = lockSpPrimary || lockWorkspaceAdminOwnerPrimary;
  const ownerWorkspaceAdminBlocksSpRemoval =
    editingMember.is_workspace_owner && editingMember.role === ROLE_WORKSPACE_ADMIN;
  const showSpAdditionalRoles =
    canAssignServiceProviderAdditionalRoles && lockSpPrimary;

  const showDepartments =
    memberFormData.role === ROLE_SERVICE_PROVIDER ||
    memberFormData.additional_roles.includes(ROLE_SERVICE_PROVIDER);

  const primaryRoleOptions = getEditablePrimaryRoleOptions(editingMember);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden="true"
        onClick={onCancel}
      />
      <section className="relative z-10 flex max-h-[min(90vh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-800">
                <LuPencil className="h-3.5 w-3.5" aria-hidden />
                Edit Member
              </span>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
                  Update Team Member
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Edit profile details, departments, role, and account status.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
              aria-label="Close form"
              onClick={onCancel}
            >
              <LuX className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <ModalSuccessBanner success={success} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={memberFormData.name}
                  onChange={(e) => onChange({ ...memberFormData, name: e.target.value })}
                  placeholder="e.g., John Doe"
                  className={MODAL_FIELD_CLASS}
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={memberFormData.email}
                  onChange={(e) => onChange({ ...memberFormData, email: e.target.value })}
                  placeholder="e.g., john@example.com"
                  className={MODAL_FIELD_CLASS}
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={memberFormData.phone}
                  onChange={(e) => onChange({ ...memberFormData, phone: e.target.value })}
                  placeholder="e.g., +1 (555) 000-0000"
                  className={MODAL_FIELD_CLASS}
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {editingMember.is_workspace_owner ? "Primary role" : "Role"}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  value={memberFormData.role}
                  onChange={(e) => {
                    const newRole = e.target.value;
                    const nextAdditional = memberFormData.additional_roles.filter(
                      (r) => r !== newRole
                    );
                    onChange({
                      ...memberFormData,
                      role: newRole,
                      additional_roles: nextAdditional,
                    });
                  }}
                  disabled={lockPrimaryRoleSelect}
                  className={`${MODAL_FIELD_CLASS} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600`}
                  required
                >
                  {primaryRoleOptions.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Status
              </label>
              <select
                value={statusLabel}
                disabled
                className={`${MODAL_FIELD_CLASS} cursor-not-allowed bg-slate-50 text-slate-600`}
                aria-readonly
              >
                <option value={statusLabel}>{statusLabel}</option>
              </select>
            </div>

            {editingMember.is_workspace_owner && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Additional roles
                </label>
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="space-y-2">
                    {ASSIGNABLE_ROLES.filter(
                      (r) =>
                        r.value !== memberFormData.role &&
                        !OWNER_DISALLOWED_ROLES.includes(r.value)
                    ).map((r) => {
                      const checked = memberFormData.additional_roles.includes(r.value);
                      const blockedServiceProviderRemoval =
                        ownerWorkspaceAdminBlocksSpRemoval &&
                        r.value === ROLE_SERVICE_PROVIDER &&
                        checked &&
                        otherActiveServiceProviderCount < 1;
                      const blockedServiceProviderAddition =
                        r.value === ROLE_SERVICE_PROVIDER &&
                        !checked &&
                        serviceProviderLimitReached &&
                        !targetActsAsServiceProvider;
                      const blockedServiceProviderRole =
                        blockedServiceProviderRemoval ||
                        blockedServiceProviderAddition;
                      return (
                        <button
                          key={r.value}
                          type="button"
                          disabled={blockedServiceProviderRole || loading}
                          title={
                            blockedServiceProviderRemoval
                              ? "Add another active service provider before removing this role."
                              : blockedServiceProviderAddition
                                ? serviceProviderLimitMessage
                                : undefined
                          }
                          onClick={() => onToggleAdditionalRole(r.value)}
                          className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                            checked
                              ? "bg-indigo-100 text-indigo-700"
                              : "text-slate-700 hover:bg-indigo-50"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                  {serviceProviderLimitReached && !targetActsAsServiceProvider ? (
                    <p className="mt-3 text-xs text-amber-800">
                      {serviceProviderLimitMessage}
                    </p>
                  ) : null}
                </div>
              </div>
            )}

            {showSpAdditionalRoles && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Additional roles
                </label>
                <p className="mb-3 text-xs text-slate-500">
                  Grants stacked workspace access without removing service provider scheduling.
                  Only workspace owners and workspace admins can edit this.
                </p>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="space-y-2">
                    {SP_ASSIGNABLE_ROLE_OPTIONS.map((r) => {
                      const checked = memberFormData.additional_roles.includes(r.value);
                      return (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => onToggleAdditionalRole(r.value)}
                          className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                            checked
                              ? "bg-indigo-100 font-medium text-indigo-800 ring-1 ring-indigo-200"
                              : "text-slate-700 hover:bg-white"
                          }`}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {showDepartments && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                    <LuBuilding2 className="h-5 w-5 text-indigo-600" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Department Assignment
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">
                      Select the departments this member can access.
                    </p>
                    <div className="mt-4">
                      <DepartmentChipSelector
                        departments={departments}
                        selectedIds={memberFormData.departments}
                        onToggle={onToggleDepartment}
                        variant="provider"
                        emptyMessage="No departments available."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function ManageRoleModal({
  open,
  loading,
  success = null,
  member,
  departments,
  memberFormData,
  canAssignServiceProviderAdditionalRoles,
  otherActiveServiceProviderCount,
  serviceProviderLimitReached,
  serviceProviderLimitMessage,
  targetActsAsServiceProvider,
  onCancel,
  onSubmit,
  onChange,
  onToggleDepartment,
  onToggleAdditionalRole,
}: {
  open: boolean;
  loading: boolean;
  success?: string | null;
  member: TeamMember;
  departments: Department[];
  memberFormData: MemberFormData;
  canAssignServiceProviderAdditionalRoles: boolean;
  /** Excluding this user: members who are not deactivated and act as service provider. */
  otherActiveServiceProviderCount: number;
  serviceProviderLimitReached: boolean;
  serviceProviderLimitMessage: string;
  targetActsAsServiceProvider: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (data: MemberFormData) => void;
  onToggleDepartment: (id: number) => void;
  onToggleAdditionalRole: (role: string) => void;
}) {
  if (!open) return null;

  const lockSpPrimary =
    !member.is_workspace_owner && member.role === ROLE_SERVICE_PROVIDER;
  const lockWorkspaceAdminOwnerPrimary =
    member.is_workspace_owner && member.role === ROLE_WORKSPACE_ADMIN;
  const lockPrimaryRoleSelect = lockSpPrimary || lockWorkspaceAdminOwnerPrimary;
  const ownerWorkspaceAdminBlocksSpRemoval =
    member.is_workspace_owner && member.role === ROLE_WORKSPACE_ADMIN;
  const showSpAdditionalRoles =
    canAssignServiceProviderAdditionalRoles && lockSpPrimary;

  const showDepartments =
    memberFormData.role === ROLE_SERVICE_PROVIDER ||
    memberFormData.additional_roles.includes(ROLE_SERVICE_PROVIDER);

  const primaryRoleOptions = getEditablePrimaryRoleOptions(member);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden="true"
        onClick={onCancel}
      />
      <section className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="min-w-0 space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900">
              <LuUserCog className="h-3.5 w-3.5" aria-hidden />
              Role Management
            </span>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
                Manage Role1
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Update role access and department permissions for{" "}
                <span className="font-semibold text-slate-800">{member.name}</span>.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
            aria-label="Close"
            onClick={onCancel}
          >
            <LuX className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <ModalSuccessBanner success={success} />
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                value={memberFormData.role}
                onChange={(e) => {
                  const newRole = e.target.value;
                  const nextAdditional = memberFormData.additional_roles.filter((r) => r !== newRole);
                  onChange({
                    ...memberFormData,
                    role: newRole,
                    additional_roles: nextAdditional,
                  });
                }}
                disabled={lockPrimaryRoleSelect}
                className={`${MODAL_FIELD_CLASS} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600`}
                required
              >
                {primaryRoleOptions.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {member.is_workspace_owner && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Additional roles
                </label>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="space-y-2">
                    {ASSIGNABLE_ROLES.filter(
                      (r) =>
                        r.value !== memberFormData.role && !OWNER_DISALLOWED_ROLES.includes(r.value),
                    ).map((r) => {
                      const checked = memberFormData.additional_roles.includes(r.value);
                      const blockedServiceProviderRemoval =
                        ownerWorkspaceAdminBlocksSpRemoval &&
                        r.value === ROLE_SERVICE_PROVIDER &&
                        checked &&
                        otherActiveServiceProviderCount < 1;
                      const blockedServiceProviderAddition =
                        r.value === ROLE_SERVICE_PROVIDER &&
                        !checked &&
                        serviceProviderLimitReached &&
                        !targetActsAsServiceProvider;
                      const blockedServiceProviderRole =
                        blockedServiceProviderRemoval ||
                        blockedServiceProviderAddition;
                      return (
                        <button
                          key={r.value}
                          type="button"
                          disabled={blockedServiceProviderRole || loading}
                          title={
                            blockedServiceProviderRemoval
                              ? "Add another active service provider before removing this role."
                              : blockedServiceProviderAddition
                                ? serviceProviderLimitMessage
                                : undefined
                          }
                          onClick={() => onToggleAdditionalRole(r.value)}
                          className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                            checked
                              ? "bg-indigo-100 font-medium text-indigo-800 ring-1 ring-indigo-200"
                              : "text-slate-700 hover:bg-white"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                  {serviceProviderLimitReached && !targetActsAsServiceProvider ? (
                    <p className="mt-3 text-xs text-amber-800">
                      {serviceProviderLimitMessage}
                    </p>
                  ) : null}
                </div>
              </div>
            )}

            {showSpAdditionalRoles && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5">
                <label className="mb-3 block text-sm font-semibold text-slate-900">
                  Additional roles
                </label>
                <p className="mb-4 text-xs text-slate-600">
                  Grant manager or workspace admin access alongside service provider scheduling.
                </p>
                <div className="space-y-2">
                  {SP_ASSIGNABLE_ROLE_OPTIONS.map((r) => {
                    const checked = memberFormData.additional_roles.includes(r.value);
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => onToggleAdditionalRole(r.value)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                          checked
                            ? "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200"
                            : "border border-slate-200 bg-white text-slate-700 hover:border-indigo-200"
                        }`}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {showDepartments ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5">
                <label className="mb-3 block text-sm font-semibold text-slate-900">
                  Department Permissions
                </label>
                <p className="mb-4 text-xs text-slate-600">
                  Select which departments this member can work with when acting as a service
                  provider.
                </p>
                <DepartmentChipSelector
                  departments={departments}
                  selectedIds={memberFormData.departments}
                  onToggle={onToggleDepartment}
                  variant="manage"
                  emptyMessage="No departments available yet."
                />
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-xl bg-indigo-600 px-5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Saving…" : "Update Role"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
