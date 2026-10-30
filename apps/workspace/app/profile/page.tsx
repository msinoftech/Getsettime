"use client";
import { getWorkspaceSession } from '@/src/lib/auth_session';
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../src/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import {
  useDepartments,
  useServices,
  useUserDepartments,
  useUserServices,
} from "@/src/hooks/useBookingLookups";
import { useWorkspaceSettings } from "@/src/hooks/useWorkspaceSettings";
import { WorkspaceBrandLogo } from "@/src/components/molecules/WorkspaceBrandLogo";
import { resolveAvatarUrlFromMetadata } from "@app/db/user-avatar";
import { writeCachedProfileImage } from "@/src/utils/profile_image_cache";
import { toast } from "@/src/components/ui/toast";

export default function ProfileCreative({ }) {
  const { user, loading } = useAuth();
  const {
    workspaceName: workspace_brand_name,
    workspaceLogoResolved,
    loading: workspaceBrandLoading,
  } = useWorkspaceSettings();
  const { data: departments, loading: departmentsLoading } = useDepartments();
  const { data: services, loading: servicesLoading } = useServices();
  const {
    byUser: deptIdsByUser,
    loading: userDeptsLoading,
    refetch: refetchUserDepts,
  } = useUserDepartments();
  const {
    byUser: serviceIdsByUser,
    loading: userServicesLoading,
    refetch: refetchUserServices,
  } = useUserServices();
  const [showPublic, setShowPublic] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    link: "",
    education: "",
    experience: "",
    specialty: "",
    bio: "",
    phone: "",
  });
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [syncingAssignments, setSyncingAssignments] = useState(false);
  const formDirtyRef = useRef(false);

  const mark_form_dirty = useCallback(() => {
    formDirtyRef.current = true;
  }, []);

  const update_form = useCallback(
    (patch: Partial<typeof form> | ((prev: typeof form) => typeof form)) => {
      mark_form_dirty();
      setForm((prev) =>
        typeof patch === "function" ? patch(prev) : { ...prev, ...patch }
      );
    },
    [mark_form_dirty]
  );

  const getAuthToken = useCallback(async () => {
    const { session } = await getWorkspaceSession();
    return session?.access_token ?? null;
  }, []);

  const parse_department_ids = (ids: string[]): number[] =>
    ids
      .map((id) => parseInt(id, 10))
      .filter((n) => Number.isFinite(n) && n > 0);

  useEffect(() => {
    if (!user) return;
    if (formDirtyRef.current) return;

    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const usernameFromEmail = user.email?.split("@")[0] || "";
    const profileSlug =
      (metadata.username as string) ||
      (metadata.slug as string) ||
      usernameFromEmail;

    setForm({
      name:
        (metadata.name as string) ||
        [metadata.first_name, metadata.last_name].filter(Boolean).join(" ") ||
        usernameFromEmail ||
        "User",
      email: user.email || "",
      link: profileSlug ? `${appUrl.replace(/\/$/, "")}/${profileSlug}` : "",
      education: (metadata.education as string) || "",
      experience: (metadata.experience as string) || "",
      specialty: (metadata.specialty as string) || "",
      bio: (metadata.bio as string) || "",
      phone: (metadata.phone as string) || "",
    });

    const avatarUrl = resolveAvatarUrlFromMetadata(metadata);
    setProfileImage(avatarUrl);
    setSelectedImageFile(null);
    setSelectedImagePreview(null);
    setShowPublic(metadata.show_public_profile !== false);
    // Only re-init when the authenticated user id changes — not on TOKEN_REFRESHED / USER_UPDATED
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user || userDeptsLoading) return;
    if (formDirtyRef.current) return;
    const fromTable = deptIdsByUser.get(user.id);
    // Table is source of truth once loaded; missing key means no assignments.
    // Do not fall back to user_metadata — it stays stale after removals and re-adds items.
    setSelectedDepartmentIds(
      fromTable ? [...fromTable].sort((a, b) => a - b).map(String) : []
    );
  }, [user, userDeptsLoading, deptIdsByUser]);

  useEffect(() => {
    if (!user || userServicesLoading) return;
    if (formDirtyRef.current) return;
    const fromTable = serviceIdsByUser.get(user.id);
    setSelectedServiceIds(fromTable ? [...fromTable].sort().map(String) : []);
  }, [user, userServicesLoading, serviceIdsByUser]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
      if (!validImageTypes.includes(file.type)) {
        toast.error("Invalid file type. Please upload JPG, PNG, GIF, or WebP.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image is too large. Maximum allowed size is 5MB.");
        return;
      }

      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImageFile(file);
        setSelectedImagePreview((reader.result as string) || null);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const sync_department_assignments = async (
    departmentIds: string[]
  ): Promise<boolean> => {
    if (!user) return false;
    const token = await getAuthToken();
    if (!token) {
      toast.error("Not authenticated");
      return false;
    }
    const res = await fetch("/api/user-departments", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        user_id: user.id,
        department_ids: parse_department_ids(departmentIds),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      toast.error(err?.error || `Failed to sync departments (${res.status})`);
      return false;
    }
    await refetchUserDepts();
    return true;
  };

  const sync_service_assignments = async (serviceIds: string[]): Promise<boolean> => {
    if (!user) return false;
    const token = await getAuthToken();
    if (!token) {
      toast.error("Not authenticated");
      return false;
    }
    const res = await fetch("/api/user-services", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        user_id: user.id,
        service_ids: Array.from(new Set(serviceIds)),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      toast.error(err?.error || `Failed to sync services (${res.status})`);
      return false;
    }
    await refetchUserServices();
    return true;
  };

  const add_department = async (departmentId: string) => {
    if (!user || selectedDepartmentIds.includes(departmentId)) return;
    const previous = selectedDepartmentIds;
    const next = [...previous, departmentId];
    setSelectedDepartmentIds(next);
    setSyncingAssignments(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setSelectedDepartmentIds(previous);
        toast.error("Not authenticated");
        return;
      }
      const department_id = parseInt(departmentId, 10);
      if (!Number.isFinite(department_id) || department_id <= 0) {
        setSelectedDepartmentIds(previous);
        return;
      }
      const res = await fetch("/api/user-departments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: user.id, department_id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setSelectedDepartmentIds(previous);
        toast.error(err?.error || `Failed to assign department (${res.status})`);
        return;
      }
      await refetchUserDepts();
    } finally {
      setSyncingAssignments(false);
    }
  };

  const remove_department = async (departmentId: string) => {
    if (!user) return;
    const previous = selectedDepartmentIds;
    const next = previous.filter((id) => id !== departmentId);
    setSelectedDepartmentIds(next);
    setSyncingAssignments(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setSelectedDepartmentIds(previous);
        toast.error("Not authenticated");
        return;
      }
      const department_id = parseInt(departmentId, 10);
      if (!Number.isFinite(department_id) || department_id <= 0) {
        setSelectedDepartmentIds(previous);
        return;
      }
      const res = await fetch(
        `/api/user-departments?user_id=${encodeURIComponent(user.id)}&department_id=${department_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setSelectedDepartmentIds(previous);
        toast.error(err?.error || `Failed to unassign department (${res.status})`);
        return;
      }
      await refetchUserDepts();
    } finally {
      setSyncingAssignments(false);
    }
  };

  const add_service = async (serviceId: string) => {
    if (!user || selectedServiceIds.includes(serviceId)) return;
    const previous = selectedServiceIds;
    const next = [...previous, serviceId];
    setSelectedServiceIds(next);
    setSyncingAssignments(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setSelectedServiceIds(previous);
        toast.error("Not authenticated");
        return;
      }
      const res = await fetch("/api/user-services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: user.id, service_id: serviceId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setSelectedServiceIds(previous);
        toast.error(err?.error || `Failed to assign service (${res.status})`);
        return;
      }
      await refetchUserServices();
    } finally {
      setSyncingAssignments(false);
    }
  };

  const remove_service = async (serviceId: string) => {
    if (!user) return;
    const previous = selectedServiceIds;
    const next = previous.filter((id) => id !== serviceId);
    setSelectedServiceIds(next);
    setSyncingAssignments(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setSelectedServiceIds(previous);
        toast.error("Not authenticated");
        return;
      }
      const res = await fetch(
        `/api/user-services?user_id=${encodeURIComponent(user.id)}&service_id=${encodeURIComponent(serviceId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setSelectedServiceIds(previous);
        toast.error(err?.error || `Failed to unassign service (${res.status})`);
        return;
      }
      await refetchUserServices();
    } finally {
      setSyncingAssignments(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      let avatarUrl = profileImage;

      // Upload selected image only when user clicks Save Changes.
      if (selectedImageFile) {
        const token = await getAuthToken();
        if (!token) {
          throw new Error("Not authenticated");
        }

        const formData = new FormData();
        formData.append("file", selectedImageFile);
        formData.append("userId", user.id);

        const uploadRes = await fetch("/api/profile/avatar", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const uploadBody = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadBody?.error || "Failed to upload profile image.");
        }

        avatarUrl = uploadBody?.url || null;
      }

      const department_ids = Array.from(new Set(selectedDepartmentIds));
      const service_ids = Array.from(new Set(selectedServiceIds));
      const department_numbers = parse_department_ids(department_ids);

      const deptSynced = await sync_department_assignments(department_ids);
      if (!deptSynced) return;

      const svcSynced = await sync_service_assignments(service_ids);
      if (!svcSynced) return;

      const currentMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          ...currentMetadata,
          name: form.name,
          phone: form.phone,
          education: form.education,
          experience: form.experience,
          specialty: form.specialty,
          bio: form.bio,
          profile_link: form.link,
          show_public_profile: showPublic,
          avatar_url: avatarUrl,
          department_ids,
          departments: department_numbers,
          service_ids,
        },
      });

      if (updateError) {
        throw new Error(updateError.message || "Failed to save profile changes.");
      }

      setProfileImage(avatarUrl);
      setSelectedImageFile(null);
      setSelectedImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      writeCachedProfileImage(avatarUrl);

      toast.success("Profile updated successfully.");
      formDirtyRef.current = false;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save profile changes.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (!user) return;
    formDirtyRef.current = false;
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.getsettime.com";
    const usernameFromEmail = user.email?.split("@")[0] || "";
    const profileSlug =
      (metadata.username as string) ||
      (metadata.slug as string) ||
      usernameFromEmail;

    setForm({
      name:
        (metadata.name as string) ||
        [metadata.first_name, metadata.last_name].filter(Boolean).join(" ") ||
        usernameFromEmail ||
        "User",
      email: user.email || "",
      link: profileSlug ? `${appUrl.replace(/\/$/, "")}/${profileSlug}` : "",
      education: (metadata.education as string) || "",
      experience: (metadata.experience as string) || "",
      specialty: (metadata.specialty as string) || "",
      bio: (metadata.bio as string) || "",
      phone: (metadata.phone as string) || "",
    });
    setShowPublic(metadata.show_public_profile !== false);
    const fromDeptTable = deptIdsByUser.get(user.id);
    const fromSvcTable = serviceIdsByUser.get(user.id);
    setSelectedDepartmentIds(
      fromDeptTable ? [...fromDeptTable].sort((a, b) => a - b).map(String) : []
    );
    setSelectedServiceIds(
      fromSvcTable ? [...fromSvcTable].sort().map(String) : []
    );
    setSelectedImageFile(null);
    setSelectedImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";
  };

  const selectedDepartments = selectedDepartmentIds
    .map((id) => departments.find((department) => department.id === id))
    .filter((department): department is { id: string; name: string } => Boolean(department));
  const selectedServices = selectedServiceIds
    .map((id) => services.find((service) => service.id === id))
    .filter((service): service is { id: string; name: string } => Boolean(service));
  const availableDepartments = departments.filter(
    (department) => !selectedDepartmentIds.includes(department.id)
  );
  const availableServices = services.filter((service) => !selectedServiceIds.includes(service.id));

  if (loading) {
    return (
      <section className="relative space-y-6 mr-auto">
        <header className="mb-8">
          <h3 className="text-2xl font-semibold text-slate-800">Profile</h3>
          <p className="text-xs text-slate-500">Loading profile details...</p>
        </header>
      </section>
    );
  }

  return (
    <section className="relative space-y-6 mr-auto">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-2xl font-semibold text-slate-800">Profile</h3>
              <p className="text-xs text-slate-500">Manage your profile information and preferences</p>
            </div>
            <Link
              href="/change-password"
              className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
            >
              Change Password
            </Link>
        </header>

        <div className="grid xl:grid-cols-3 gap-6">
            {/* Left Column - Profile Image & Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
                <div className="col-span-6 sm:col-span-1 xl:col-span-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Workspace
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    {!workspaceBrandLoading ? (
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-white p-1 grid place-items-center">
                        <WorkspaceBrandLogo
                          src={workspaceLogoResolved}
                          alt={workspace_brand_name || "Workspace"}
                          width={48}
                          height={48}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-slate-100" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {workspace_brand_name || "Workspace"}
                      </p>
                      <p className="text-xs text-slate-500">
                        Branding shown in the app and booking flows
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/settings"
                    className="mt-4 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Change workspace logo →
                  </Link>
                </div>

                {/* Profile Image Card */}
                <div className="col-span-6 sm:col-span-1 xl:col-span-6 basis-1/2 bg-white rounded-2xl shadow-xl p-4 border border-gray-100">
                    <div className="flex items-center gap-4 text-center">
                      <div className="relative inline-block">
                          <div className={`w-22 h-22 rounded-full ${ selectedImagePreview || profileImage ? "bg-gray-100" : "bg-gradient-to-br  from-indigo-500 to-purple-600" } grid place-items-center text-4xl font-bold text-white shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer overflow-hidden`} onClick={() => fileInputRef.current?.click()}>
                          {selectedImagePreview || profileImage ? (
                              <img src={selectedImagePreview || profileImage || ""} alt="Profile" className="w-full h-full object-cover"/>
                          ) : (
                              <span>{getInitials(form.name)}</span>
                          )}
                          </div>
                          {isUploading && (
                          <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                              <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                              </svg>
                          </div>
                          )}
                          {/* <div className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-700 transition cursor-pointer">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                          </svg>
                          </div> */}
                      </div>
                      <div>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden"/>
                        <button onClick={() => fileInputRef.current?.click()} className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-indigo-500 hover:text-indigo-600 transition  font-medium">
                            Change Photo
                        </button>
                        <p className="text-xs text-gray-500 mt-2">JPG, PNG, GIF, or WebP. Max size 5MB</p>
                        {selectedImageFile && (
                          <p className="text-xs text-amber-600 mt-2">
                            New image selected. Click Save Changes to upload.
                          </p>
                        )}
                      </div>
                    </div>
                </div>

                {/* Profile Preview Card */}
                <div className="col-span-6 sm:col-span-3 xl:col-span-6 bg-indigo-600 rounded-2xl shadow-xl p-4 sm:p-6 text-white">
                    <h3 className="font-semibold mb-4 text-lg">Profile Preview</h3>
                    <div className="space-y-2">
                        <div>
                            <p className="text-xs opacity-80 mb-1">Name</p>
                            <div className="text-sm">{form.name || "Your Name"}</div>
                        </div>
                        <div>   
                            <p className="text-xs opacity-80 mb-1">Email</p>
                            <div className="text-sm">{form.email || "Your Email"}</div>
                        </div>
                        <div>   
                            <p className="text-xs opacity-80 mb-1">Phone</p>
                            <div className="text-sm">{form.phone || "Your Phone"}</div>
                        </div>
                        <div>
                            <p className="text-xs opacity-80 mb-1">Study/Education</p>
                            <div className="text-sm">{form.education || "Your education"}</div>
                        </div>
                        <div>
                            <p className="text-xs opacity-80 mb-1">Experience</p>
                            <div className="text-sm">{form.experience || "Your experience"}</div>
                        </div>
                        <div>
                            <p className="text-xs opacity-80 mb-1">Specialty</p>
                            <div className="text-sm">{form.specialty || "Your specialty"}</div>
                        </div>
                        <div>   
                            <p className="text-xs opacity-80 mb-1">Bio</p>
                            <div className="text-sm">{form.bio || "Your Bio"}</div>
                        </div>
                        <div>
                            <p className="text-xs opacity-80 mb-1">Departments</p>
                            <div className="text-sm">
                              {selectedDepartments.length > 0
                                ? selectedDepartments.map((department) => department.name).join(", ")
                                : "No departments selected"}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs opacity-80 mb-1">Services</p>
                            <div className="text-sm">
                              {selectedServices.length > 0
                                ? selectedServices.map((service) => service.name).join(", ")
                                : "No services selected"}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column - Form */}
            <div className="xl:col-span-2 space-y-6">
                {/* Basic Information Card */}
                <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-8 border border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">Basic Information</h2>

                    <div className="space-y-5">
                        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
                            {/* Name Field */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                                        </svg>
                                    </div>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => update_form({ name: e.target.value })}
                                        className="text-sm w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 transition"
                                        placeholder="John Doe"
                                    />
                                </div>
                            </div>

                            {/* Email Field */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"/>
                                        </svg>
                                    </div>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => update_form({ email: e.target.value })}
                                        className="text-sm w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                                        placeholder="john@example.com"
                                    />
                                </div>
                            </div>

                            {/* Phone Field */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                                        </svg>
                                    </div>
                                    <input
                                        type="tel"
                                        value={form.phone}
                                        onChange={(e) => update_form({ phone: e.target.value })}
                                        className="text-sm w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                                        placeholder="+1 (555) 000-0000"
                                    />
                                </div>
                            </div>

                            {/* Study/Education Field */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Study/Education</label>
                              <input
                                type="text"
                                value={form.education}
                                onChange={(e) => update_form({ education: e.target.value })}
                                className="text-sm w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                                placeholder="e.g. MBBS, Stanford University"
                              />
                            </div>

                            {/* Experience Field */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Experience</label>
                                <input
                                  type="text"
                                  value={form.experience}
                                  onChange={(e) => update_form({ experience: e.target.value })}
                                  className="text-sm w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                                  placeholder="e.g. 10+ years in cardiology"
                                />
                            </div>

                            {/* Specialty Field */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Specialty</label>
                                <input
                                  type="text"
                                  value={form.specialty}
                                  onChange={(e) => update_form({ specialty: e.target.value })}
                                  className="text-sm w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                                  placeholder="e.g. Cardiology, Dermatology"
                                />
                            </div>
                        </div>

                        {/* Bio Field */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                            <textarea
                            value={form.bio}
                            onChange={(e) => update_form({ bio: e.target.value })}
                            rows={4}
                            className="text-sm w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
                            placeholder="Tell us about yourself..."
                            />
                        </div>
                        
                        {/* Department */}
                        <div className="p-3 rounded-2xl border border-gray-200">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <label className="text-sm font-semibold text-gray-700">Departments</label>
                              <Link
                                href="/departments"
                                className="text-sm font-semibold text-indigo-600 hover:text-indigo-900 underline-offset-2 hover:underline"
                              >
                                Add Department
                              </Link>
                            </div>
                            {selectedDepartments.length > 0 && (
                              <div className="mb-3 flex flex-wrap gap-2">
                                {selectedDepartments.map((department) => (
                                  <span
                                    key={department.id}
                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm border border-indigo-200 bg-indigo-100 text-indigo-600"
                                  >
                                    {department.name}
                                    <button
                                      type="button"
                                      onClick={() => void remove_department(department.id)}
                                      disabled={syncingAssignments || isSaving}
                                      className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-indigo-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                      aria-label={`Remove ${department.name}`}
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            {departmentsLoading ? (
                              <div className="text-sm text-slate-500">Loading departments...</div>
                            ) : availableDepartments.length > 0 ? (
                              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto border border-gray-300 py-2 px-2 rounded-xl">
                                {availableDepartments.map((department) => (
                                  <button
                                    key={department.id}
                                    type="button"
                                    onClick={() => void add_department(department.id)}
                                    disabled={syncingAssignments || isSaving}
                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border border-dashed border-slate-300 bg-white text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {department.name}
                                    <span className="text-slate-400" aria-hidden>
                                      +
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-slate-500">
                                {departments.length === 0
                                  ? "No departments available."
                                  : "No more departments available to add."}
                              </div>
                            )}
                        </div>
                        
                        {/* Services */}
                        <div className="p-3 rounded-2xl border border-gray-200">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <label className="text-sm font-semibold text-gray-700">Services</label>
                              <Link
                                href="/services"
                                className="text-sm font-semibold text-indigo-600 hover:text-indigo-900 underline-offset-2 hover:underline"
                              >
                                Add Service
                              </Link>
                            </div>
                            {selectedServices.length > 0 && (
                              <div className="mb-3 flex flex-wrap gap-2">
                                {selectedServices.map((service) => (
                                  <span
                                    key={service.id}
                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm border border-emerald-200 bg-emerald-100 text-emerald-800"
                                  >
                                    {service.name}
                                    <button
                                      type="button"
                                      onClick={() => void remove_service(service.id)}
                                      disabled={syncingAssignments || isSaving}
                                      className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-emerald-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                      aria-label={`Remove ${service.name}`}
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            {servicesLoading ? (
                              <div className="text-sm text-slate-500">Loading services...</div>
                            ) : availableServices.length > 0 ? (
                              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto border border-gray-300 py-2 px-2 rounded-xl">
                                {availableServices.map((service) => (
                                  <button
                                    key={service.id}
                                    type="button"
                                    onClick={() => void add_service(service.id)}
                                    disabled={syncingAssignments || isSaving}
                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm border border-dashed border-slate-300 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {service.name}
                                    <span className="text-slate-400" aria-hidden>
                                      +
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-slate-500">
                                {services.length === 0
                                  ? "No services available."
                                  : "No more services available to add."}
                              </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-end gap-4">
                  <div className="flex shrink-0 justify-end gap-4">
                    <button
                      onClick={handleSaveChanges}
                      disabled={isSaving || syncingAssignments}
                      className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                    >
                      {isSaving ? "Saving..." : syncingAssignments ? "Syncing..." : "Save Changes"}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={isSaving || syncingAssignments}
                      className="inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
            </div>
        </div>
    </section>
    
  );
}