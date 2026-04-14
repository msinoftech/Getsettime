"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../src/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { useDepartments, useServices } from "@/src/hooks/useBookingLookups";

export default function ProfileCreative({ }) {
  const PROFILE_IMAGE_STORAGE_KEY = "workspace_profile_image";
  const PROFILE_IMAGE_EVENT = "workspace-profile-image-updated";
  const { user, loading } = useAuth(); 
  const { data: departments, loading: departmentsLoading } = useDepartments();
  const { data: services, loading: servicesLoading } = useServices();
  const [showPublic, setShowPublic] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    link: "",
    bio: "",
    phone: "",
  });
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [needsDepartmentFallback, setNeedsDepartmentFallback] = useState(false);
  const [needsServiceFallback, setNeedsServiceFallback] = useState(false);

  const normalize_ids = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return Array.from(
      new Set(
        value
          .map((item) => (typeof item === "string" || typeof item === "number" ? String(item).trim() : ""))
          .filter((item) => item.length > 0)
      )
    );
  };

  useEffect(() => {
    if (!user) return;

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
      bio: (metadata.bio as string) || "",
      phone: (metadata.phone as string) || "",
    });

    const avatarUrl =
      (metadata.avatar_url as string) ||
      (metadata.picture as string) ||
      null;
    setProfileImage(avatarUrl);
    setSelectedImageFile(null);
    setSelectedImagePreview(null);
    setShowPublic(metadata.show_public_profile !== false);
    const metadataDepartmentIds = normalize_ids(metadata.department_ids);
    const metadataServiceIds = normalize_ids(metadata.service_ids);
    setSelectedDepartmentIds(metadataDepartmentIds);
    setSelectedServiceIds(metadataServiceIds);
    setNeedsDepartmentFallback(metadataDepartmentIds.length === 0);
    setNeedsServiceFallback(metadataServiceIds.length === 0);
  }, [user]);

  useEffect(() => {
    if (needsDepartmentFallback && !departmentsLoading && selectedDepartmentIds.length === 0 && departments.length > 0) {
      setSelectedDepartmentIds([departments[0].id]);
      setNeedsDepartmentFallback(false);
    }
  }, [departments, departmentsLoading, needsDepartmentFallback, selectedDepartmentIds.length]);

  useEffect(() => {
    if (needsServiceFallback && !servicesLoading && selectedServiceIds.length === 0 && services.length > 0) {
      setSelectedServiceIds([services[0].id]);
      setNeedsServiceFallback(false);
    }
  }, [needsServiceFallback, selectedServiceIds.length, services, servicesLoading]);

  const FEEDBACK_AUTO_DISMISS_MS = 5000;

  useEffect(() => {
    if (!feedback) return;
    const id = window.setTimeout(() => setFeedback(null), FEEDBACK_AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [feedback]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
      if (!validImageTypes.includes(file.type)) {
        setFeedback({ type: "error", message: "Invalid file type. Please upload JPG, PNG, GIF, or WebP." });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setFeedback({ type: "error", message: "Image is too large. Maximum allowed size is 5MB." });
        return;
      }

      setIsUploading(true);
      setFeedback(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImageFile(file);
        setSelectedImagePreview((reader.result as string) || null);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const add_department = (departmentId: string) => {
    if (selectedDepartmentIds.includes(departmentId)) return;
    setSelectedDepartmentIds((prev) => [...prev, departmentId]);
  };

  const remove_department = (departmentId: string) => {
    setSelectedDepartmentIds((prev) => prev.filter((id) => id !== departmentId));
  };

  const add_service = (serviceId: string) => {
    if (selectedServiceIds.includes(serviceId)) return;
    setSelectedServiceIds((prev) => [...prev, serviceId]);
  };

  const remove_service = (serviceId: string) => {
    setSelectedServiceIds((prev) => prev.filter((id) => id !== serviceId));
  };

  const handleSaveChanges = async () => {
    if (!user) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      let avatarUrl = profileImage;

      // Upload selected image only when user clicks Save Changes.
      if (selectedImageFile) {
        const formData = new FormData();
        formData.append("file", selectedImageFile);
        formData.append("userId", user.id);

        const uploadRes = await fetch("/api/profile/avatar", {
          method: "POST",
          body: formData,
        });

        const uploadBody = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadBody?.error || "Failed to upload profile image.");
        }

        avatarUrl = uploadBody?.url || null;
      }

      const currentMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const department_ids = Array.from(new Set(selectedDepartmentIds));
      const service_ids = Array.from(new Set(selectedServiceIds));
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          ...currentMetadata,
          name: form.name,
          phone: form.phone,
          bio: form.bio,
          profile_link: form.link,
          show_public_profile: showPublic,
          avatar_url: avatarUrl,
          department_ids,
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

      if (typeof window !== "undefined") {
        if (avatarUrl) {
          window.localStorage.setItem(PROFILE_IMAGE_STORAGE_KEY, avatarUrl);
        } else {
          window.localStorage.removeItem(PROFILE_IMAGE_STORAGE_KEY);
        }
        window.dispatchEvent(new Event(PROFILE_IMAGE_EVENT));
      }

      setFeedback({ type: "success", message: "Profile updated successfully." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save profile changes.";
      setFeedback({ type: "error", message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (!user) return;
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
      bio: (metadata.bio as string) || "",
      phone: (metadata.phone as string) || "",
    });
    setShowPublic(metadata.show_public_profile !== false);
    const metadataDepartmentIds = normalize_ids(metadata.department_ids);
    const metadataServiceIds = normalize_ids(metadata.service_ids);
    setSelectedDepartmentIds(
      metadataDepartmentIds.length > 0
        ? metadataDepartmentIds
        : departments.length > 0
          ? [departments[0].id]
          : []
    );
    setSelectedServiceIds(
      metadataServiceIds.length > 0
        ? metadataServiceIds
        : services.length > 0
          ? [services[0].id]
          : []
    );
    setNeedsDepartmentFallback(false);
    setNeedsServiceFallback(false);
    setSelectedImageFile(null);
    setSelectedImagePreview(null);
    setFeedback(null);
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

        <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Profile Image & Preview */}
            <div className="lg:col-span-1 space-y-6">
                {/* Profile Image Card */}
                <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                    <div className="text-center">
                    <div className="relative inline-block mb-4">
                        <div className={`w-32 h-32 rounded-full ${ selectedImagePreview || profileImage ? "bg-gray-100" : "bg-gradient-to-br  from-blue-500 to-purple-600" } grid place-items-center text-4xl font-bold text-white shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer overflow-hidden`} onClick={() => fileInputRef.current?.click()}>
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
                        {/* <div className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition cursor-pointer">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        </div> */}
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden"/>
                    <button onClick={() => fileInputRef.current?.click()} className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-blue-500 hover:text-blue-600 transition  font-medium">
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

                {/* Profile Preview Card */}
                <div className="bg-gradient-to-br from-indigo-600 to-emerald-300 rounded-2xl shadow-xl p-6 text-white">
                    <h3 className="font-semibold mb-4 text-lg">Profile Preview</h3>
                    <div className="space-y-3">
                        <div>
                            <p className="text-xs opacity-80 mb-1">Name</p>
                            <p className="font-medium">{form.name || "Your Name"}</p>
                        </div>
                        <div>   
                            <p className="text-xs opacity-80 mb-1">Email</p>
                            <p className="font-medium">{form.email || "Your Email"}</p>
                        </div>
                        <div>   
                            <p className="text-xs opacity-80 mb-1">Phone</p>
                            <p className="font-medium">{form.phone || "Your Phone"}</p>
                        </div>
                        <div>   
                            <p className="text-xs opacity-80 mb-1">Bio</p>
                            <p className="font-medium">{form.bio || "Your Bio"}</p>
                        </div>
                        <div>
                            <p className="text-xs opacity-80 mb-1">Departments</p>
                            <p className="font-medium">
                              {selectedDepartments.length > 0
                                ? selectedDepartments.map((department) => department.name).join(", ")
                                : "No departments selected"}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs opacity-80 mb-1">Services</p>
                            <p className="font-medium">
                              {selectedServices.length > 0
                                ? selectedServices.map((service) => service.name).join(", ")
                                : "No services selected"}
                            </p>
                        </div>
                    </div>

                </div>
            </div>

            {/* Right Column - Form */}
            <div className="lg:col-span-2 space-y-6">
                {/* Basic Information Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">Basic Information</h2>

                    <div className="space-y-5">
                        {/* Name Field */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                    placeholder="John Doe"
                                />
                            </div>
                        </div>

                        {/* Email Field */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"/>
                                    </svg>
                                </div>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                    placeholder="john@example.com"
                                />
                            </div>
                        </div>

                        {/* Phone Field */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                                    </svg>
                                </div>
                                <input
                                    type="tel"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                    placeholder="+1 (555) 000-0000"
                                />
                            </div>
                        </div>

                        {/* Bio Field */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                            <textarea
                            value={form.bio}
                            onChange={(e) => setForm({ ...form, bio: e.target.value })}
                            rows={4}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                            placeholder="Tell us about yourself..."
                            />
                        </div>

                        <div>
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <label className="text-sm font-medium text-gray-700">Departments</label>
                              <Link
                                href="/departments"
                                className="text-sm font-semibold text-indigo-700 hover:text-indigo-900 underline-offset-2 hover:underline"
                              >
                                Add Department
                              </Link>
                            </div>
                            {selectedDepartments.length > 0 && (
                              <div className="mb-3 flex flex-wrap gap-2">
                                {selectedDepartments.map((department) => (
                                  <span
                                    key={department.id}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"
                                  >
                                    {department.name}
                                    <button
                                      type="button"
                                      onClick={() => remove_department(department.id)}
                                      className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-indigo-200 transition"
                                      aria-label={`Remove ${department.name}`}
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            {departmentsLoading ? (
                              <div className="text-sm text-slate-500">Loading departments...</div>
                            ) : availableDepartments.length > 0 ? (
                              <div className="border border-slate-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                                <div className="space-y-2">
                                  {availableDepartments.map((department) => (
                                    <button
                                      key={department.id}
                                      type="button"
                                      onClick={() => add_department(department.id)}
                                      className="w-full text-left px-3 py-2 rounded-md text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
                                    >
                                      {department.name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-slate-500 border border-slate-300 rounded-lg p-3">
                                No more departments available to add.
                              </div>
                            )}
                        </div>

                        <div>
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <label className="text-sm font-medium text-gray-700">Services</label>
                              <Link
                                href="/services"
                                className="text-sm font-semibold text-indigo-700 hover:text-indigo-900 underline-offset-2 hover:underline"
                              >
                                Add Service
                              </Link>
                            </div>
                            {selectedServices.length > 0 && (
                              <div className="mb-3 flex flex-wrap gap-2">
                                {selectedServices.map((service) => (
                                  <span
                                    key={service.id}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800"
                                  >
                                    {service.name}
                                    <button
                                      type="button"
                                      onClick={() => remove_service(service.id)}
                                      className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-emerald-200 transition"
                                      aria-label={`Remove ${service.name}`}
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            {servicesLoading ? (
                              <div className="text-sm text-slate-500">Loading services...</div>
                            ) : availableServices.length > 0 ? (
                              <div className="border border-slate-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                                <div className="space-y-2">
                                  {availableServices.map((service) => (
                                    <button
                                      key={service.id}
                                      type="button"
                                      onClick={() => add_service(service.id)}
                                      className="w-full text-left px-3 py-2 rounded-md text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition"
                                    >
                                      {service.name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-slate-500 border border-slate-300 rounded-lg p-3">
                                No more services available to add.
                              </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 basis-full sm:basis-0 sm:max-w-md" role="status" aria-live="polite">
                    {feedback ? (
                      <p
                        className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-sm ${
                          feedback.type === "success"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-red-200 bg-red-50 text-red-800"
                        }`}
                      >
                        {feedback.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 justify-end gap-4">
                    <button
                      onClick={handleSaveChanges}
                      disabled={isSaving}
                      className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={isSaving}
                      className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition disabled:opacity-60 disabled:cursor-not-allowed"
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