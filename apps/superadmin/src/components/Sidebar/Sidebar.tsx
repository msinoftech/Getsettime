"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "../../providers/AuthProvider";

const PATH_TO_MENU: Record<string, string> = {
  "/": "dashboard",
  "/users": "users",
  "/workspaces": "workspaces",
  "/professions": "professions",
  "/departments": "departments",
  "/services": "services",
  "/bookings": "bookings",
  "/settings": "settings",
};
function pathnameToActiveMenu(pathname: string): string {
  if (pathname === "/") return "dashboard";
  for (const [path, menu] of Object.entries(PATH_TO_MENU)) {
    if (path !== "/" && pathname === path) return menu;
    if (path !== "/" && pathname.startsWith(path + "/")) return menu;
  }
  return "";
}

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const PROFILE_IMAGE_STORAGE_KEY = "superadmin_profile_image";
  const PROFILE_IMAGE_EVENT = "profile-image-updated";
  

  const [newBookingsCount, setNewBookingsCount] = useState(0);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const pathname = usePathname();
  const { user } = useAuth();

  const activeMenu = pathnameToActiveMenu(pathname);

  const fetchNewBookingsCount = useCallback(async () => {
    try {
      const res = await fetch('/api/bookings/new-count');
      if (res.ok) {
        const { count } = await res.json();
        setNewBookingsCount(count ?? 0);
      }
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchNewBookingsCount();
    const interval = setInterval(fetchNewBookingsCount, 60_000);
    return () => clearInterval(interval);
  }, [fetchNewBookingsCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const metadataAvatar =
      (metadata.avatar_url as string) ||
      (metadata.picture as string) ||
      null;

    const updateAvatar = () => {
      const savedAvatar = window.localStorage.getItem(PROFILE_IMAGE_STORAGE_KEY);
      const normalizedSavedAvatar =
        savedAvatar && !savedAvatar.startsWith("data:") ? savedAvatar : null;
      setProfileImage(normalizedSavedAvatar || metadataAvatar);
    };

    updateAvatar();
    window.addEventListener(PROFILE_IMAGE_EVENT, updateAvatar);
    window.addEventListener("storage", updateAvatar);

    return () => {
      window.removeEventListener(PROFILE_IMAGE_EVENT, updateAvatar);
      window.removeEventListener("storage", updateAvatar);
    };
  }, [user]);

  const handleNavClick = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      onClose?.();
    }
  };

  return (
    <aside className={`bg-white border-r border-gray-200 fixed top-0 left-0 z-40 h-screen w-64 flex flex-col justify-between transition-transform duration-300 ease-in-out ${ isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} shadow-lg`}>

      <div className="relative">
        <div className="h-16 px-3 flex items-center justify-start border-b border-gray-200">
          <Link href="/" className="logo w-full relative" onClick={handleNavClick}>
            <Image src="/getsettime-logo.svg" alt="GetSetTime Logo" width={150} height={40} />
            <span className="text-xs flex justify-end absolute right-0 bottom-0 text-indigo-600">Superadmin</span>
          </Link>
        </div>

        <nav className="px-3 space-y-1 mt-6 overflow-y-auto max-h-[calc(100vh-10rem)]">
          <Link href="/" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${activeMenu === "dashboard" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50"}`} onClick={handleNavClick}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-house h-4.5 w-4.5"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
            Dashboard
          </Link>
          
          <Link href="/users" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "users" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-users-icon lucide-users"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/></svg>
            Users
          </Link>    
          
          <Link href="/workspaces" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "workspaces" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-briefcase-business-icon lucide-briefcase-business"><path d="M12 12h.01"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M22 13a18.15 18.15 0 0 1-20 0"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>
            Workspaces
          </Link>        
          
          <Link href="/professions" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "professions" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-book-open-check-icon lucide-book-open-check"><path d="M12 21V7"/><path d="m16 12 2 2 4-4"/><path d="M22 6V4a1 1 0 0 0-1-1h-5a4 4 0 0 0-4 4 4 4 0 0 0-4-4H3a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h6a3 3 0 0 1 3 3 3 3 0 0 1 3-3h6a1 1 0 0 0 1-1v-1.3"/></svg>
            Professions
          </Link>        

          <Link href="/departments" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "departments" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-building2-icon lucide-building-2"><path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/></svg>
            Departments
          </Link>        

          <Link href="/services" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "services" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-stethoscope"><path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3a7 7 0 0 0 14 0"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/></svg>
            Services
          </Link>
          
          <Link href="/bookings" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "bookings" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-clipboard-list-icon lucide-clipboard-list"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
            All Bookings
            {newBookingsCount > 0 && (
              <span className="ml-auto inline-flex items-center justify-center rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white min-w-[20px]">
                {newBookingsCount}
              </span>
            )}
          </Link>        
          
          <Link href="/settings" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "settings" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings-icon lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>
            Settings
          </Link>        
        </nav>
      </div>

      <div className="relative px-3 mb-3">
        <div className="w-full border-t border-gray-200 p-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white overflow-hidden">
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-medium">
                  {user?.email ? user.email.charAt(0).toUpperCase() : "SA"}
                </span>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white truncate max-w-[150px]">
                {user?.user_metadata?.name || user?.email?.split('@')[0] || "Superadmin"}
              </p>
              <p className="text-xs text-white truncate max-w-[150px]">
                {user?.email || "admin@example.com"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}