"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../src/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";

export default function ProfileCreative({ }) {
  const PROFILE_IMAGE_STORAGE_KEY = "workspace_profile_image";
  const PROFILE_IMAGE_EVENT = "workspace-profile-image-updated";
  const { user, loading } = useAuth(); 
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
  }, [user]);

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
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          ...currentMetadata,
          name: form.name,
          phone: form.phone,
          bio: form.bio,
          profile_link: form.link,
          show_public_profile: showPublic,
          avatar_url: avatarUrl,
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
        <header className="mb-8">
            <h3 className="text-2xl font-semibold text-slate-800">Profile</h3>
            <p className="text-xs text-slate-500">Manage your profile information and preferences</p>
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