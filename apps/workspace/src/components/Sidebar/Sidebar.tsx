"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "../../providers/AuthProvider";
import { useWorkspaceSettings } from "../../hooks/useWorkspaceSettings";
import { supabase } from "@/lib/supabaseClient";

const PATH_TO_MENU: Record<string, string> = {
  "/": "dashboard",
  "/event-type": "event-type",
  "/bookings": "bookings",
  "/emergency-booking": "emergency-booking",
  "/availability": "availability",
  "/intakeform": "intakeform",
  "/departments": "departments",
  "/services": "services",
  "/notifications": "notifications",
  "/integrations": "integrations",
  "/team-members": "team-members",
  "/team": "team",
  "/profile": "profile",
  "/settings": "settings",
  "/billings": "billings",
  "/contacts": "contacts",
  "/roles-permissions": "roles-permissions",
  "/calendar": "calendar",
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
  const PROFILE_IMAGE_STORAGE_KEY = "workspace_profile_image";
  const PROFILE_IMAGE_EVENT = "workspace-profile-image-updated";

  const [isDepartmentsSubmenuOpen, setIsDepartmentsSubmenuOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const pathname = usePathname();
  const { user } = useAuth();
  const { general, loading: loadingConfig, workspaceName, workspaceLogo } = useWorkspaceSettings();

  const activeMenu = pathnameToActiveMenu(pathname);

  const [newBookingsCount, setNewBookingsCount] = useState(0);

  const fetchNewBookingsCount = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    try {
      const res = await fetch('/api/bookings/new-count', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
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
    window.addEventListener('bookings-viewed-update', fetchNewBookingsCount);
    return () => {
      clearInterval(interval);
      window.removeEventListener('bookings-viewed-update', fetchNewBookingsCount);
    };
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

  const logoUrl = workspaceLogo || "/getsettime-logo.svg";
  const accountName = workspaceName || "GetSetTime";
  const isExternalUrl = logoUrl?.startsWith('http://') || logoUrl?.startsWith('https://');

  const handleNavClick = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      onClose?.();
    }
  };

  useEffect(() => {
    if (pathname === "/services" || pathname === "/departments") {
      setIsDepartmentsSubmenuOpen(true);
    } else {
      setIsDepartmentsSubmenuOpen(false);
    }
  }, [pathname]);

  return (
    <aside className={`bg-white border-r border-gray-200 fixed top-0 left-0 z-40 h-screen w-64 flex flex-col justify-between transition-transform duration-300 ease-in-out ${ isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} shadow-lg`}>
      
      <div className="relative">
        <div className="h-16 px-3 flex items-center justify-start border-b border-gray-200">
          <Link href="/" className="logo flex items-center gap-2" onClick={handleNavClick}>
            {!loadingConfig && (
              <>
                {isExternalUrl ? (
                  <img 
                    src={logoUrl} 
                    alt={`${accountName} Logo`} 
                    className="h-10 w-auto object-contain"
                  />
                ) : (
                  <Image 
                    src={logoUrl} 
                    alt={`${accountName} Logo`} 
                    width={150} 
                    height={40} 
                    className="object-contain"
                  />
                )}
                {accountName && accountName !== "GetSetTime" && (
                  <span className="text-xs sm:text-sm font-semibold text-gray-700 truncate max-w-[100px]">
                    {accountName}
                  </span>
                )}
              </>
            )}
          </Link>
        </div>

        <div className="py-6 px-3 overflow-y-auto max-h-[calc(100vh-10rem)]">
          <nav className="space-y-1">
            <Link href="/" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${activeMenu === "dashboard" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50"}`} onClick={handleNavClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-house h-4.5 w-4.5" aria-hidden="true" data-source-pos="107:20-107:52" data-source-name="Icon"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
              Dashboard
            </Link>
            <Link href="/event-type" prefetch={false} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "event-type" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-book-open h-4.5 w-4.5" aria-hidden="true" data-source-pos="107:20-107:52" data-source-name="Icon"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg>
              Event Type
            </Link> 
            <Link href="/bookings" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "bookings" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar-days h-4.5 w-4.5" aria-hidden="true" data-source-pos="107:20-107:52" data-source-name="Icon"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path><path d="M16 18h.01"></path></svg>
              Bookings
              {newBookingsCount > 0 && (
                <span className="ml-auto inline-flex items-center justify-center rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white min-w-[20px]">
                  {newBookingsCount}
                </span>
              )}
            </Link>
            <Link href="/calendar" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "calendar" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar-range-icon lucide-calendar-range h-4.5 w-4.5"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M17 14h-6"/><path d="M13 18H7"/><path d="M7 14h.01"/><path d="M17 18h.01"/></svg>
              Calendar
            </Link>
            <Link href="/emergency-booking" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "emergency-booking" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield-alert h-4.5 w-4.5" aria-hidden="true" data-source-pos="107:20-107:52" data-source-name="Icon"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>
              Emergency Booking
            </Link>
            <Link href="/availability" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "availability" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-clock3 lucide-clock-3 h-4.5 w-4.5" aria-hidden="true" data-source-pos="107:20-107:52" data-source-name="Icon"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6h4"></path></svg>
              Availability
            </Link>        
            <Link href="/intakeform" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "intakeform" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-rectangle-ellipsis h-4.5 w-4.5" aria-hidden="true" data-source-pos="107:20-107:52" data-source-name="Icon"><rect width="20" height="12" x="2" y="6" rx="2"></rect><path d="M12 12h.01"></path><path d="M17 12h.01"></path><path d="M7 12h.01"></path></svg>
              Forms
            </Link>
            <div className="space-y-1">
              <div className={`flex items-stretch justify-between rounded-md ${ activeMenu === "departments" || activeMenu === "services" ? "bg-indigo-50 shadow-sm" : "text-gray-700 hover:bg-gray-50" }`}>
                <Link href="/departments" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "departments" ? "text-indigo-700" : "text-gray-700" }`} onClick={() => { setIsDepartmentsSubmenuOpen(true); handleNavClick(); }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-building2 lucide-building-2 h-4.5 w-4.5" aria-hidden="true" data-source-pos="107:20-107:52" data-source-name="Icon"><path d="M10 12h4"></path><path d="M10 8h4"></path><path d="M14 21v-3a2 2 0 0 0-4 0v3"></path><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"></path><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"></path></svg>
                  <span className="truncate">Departments</span>
                </Link>
                <button
                  type="button"
                  id="sidebar-dept-submenu-toggle"
                  aria-expanded={isDepartmentsSubmenuOpen}
                  aria-controls="sidebar-dept-submenu"
                  onClick={() => setIsDepartmentsSubmenuOpen((open) => !open)}
                  className={`flex shrink-0 items-center justify-end rounded-r-xl px-2 py-2 text-gray-600 hover:bg-gray-100/80 ${
                    activeMenu === "services" ? "text-blue-600" : ""
                  }`}
                  aria-label={isDepartmentsSubmenuOpen ? "Hide services submenu" : "Show services submenu"}
                >
                  <svg
                    className={`h-4 w-4 transition-transform ${isDepartmentsSubmenuOpen ? "rotate-90" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              {isDepartmentsSubmenuOpen && (
                <div id="sidebar-dept-submenu" className="ml-3 space-y-1">
                  <Link href="/services" className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "services" ? "bg-indigo-50  text-indigo-700 shadow-sm" : "text-gray-600 hover:bg-gray-50" }`} onClick={handleNavClick}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-life-buoy-icon lucide-life-buoy"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/></svg>
                    Services
                  </Link>
                </div>
              )}
            </div>
            <Link href="/notifications" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "notifications" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bell h-4.5 w-4.5" aria-hidden="true" data-source-pos="107:20-107:52" data-source-name="Icon"><path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path></svg>
              Notifications
            </Link>
            <Link href="/integrations" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "integrations" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plug-zap h-4.5 w-4.5" aria-hidden="true" data-source-pos="107:20-107:52" data-source-name="Icon"><path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z"></path><path d="m2 22 3-3"></path><path d="M7.5 13.5 10 11"></path><path d="M10.5 16.5 13 14"></path><path d="m18 3-4 4h6l-4 4"></path></svg>
              Integrations
            </Link>        
            <Link href="/team-members" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "team-members" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-users h-4.5 w-4.5" aria-hidden="true" data-source-pos="107:20-107:52" data-source-name="Icon"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><path d="M16 3.128a4 4 0 0 1 0 7.744"></path><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><circle cx="9" cy="7" r="4"></circle></svg>
              Team Members
            </Link>      
            {/* <Link href="/billings" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "billings" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={() => setActiveMenu("billings")}>
              <FcCurrencyExchange className="h-5 w-5 mr-3" />
              Billings
            </Link>  
            <Link href="/profile" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "profile" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
              <FcBusinessman className="h-5 w-5 mr-3" />
              Profile
            </Link> */}
            <Link href="/contacts" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "contacts" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-contact h-4.5 w-4.5" aria-hidden="true" data-source-pos="107:20-107:52" data-source-name="Icon"><path d="M16 2v2"></path><path d="M7 22v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"></path><path d="M8 2v2"></path><circle cx="12" cy="11" r="3"></circle><rect x="3" y="4" width="18" height="18" rx="2"></rect></svg>
              Contacts
            </Link>
            <Link href="/roles-permissions" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "roles-permissions" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield-check h-4.5 w-4.5" aria-hidden="true" data-source-pos="107:20-107:52" data-source-name="Icon"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg>
              Roles &amp; permissions
            </Link>
            <Link href="/settings" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-all ${ activeMenu === "settings" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings h-4.5 w-4.5" aria-hidden="true" data-source-pos="107:20-107:52" data-source-name="Icon"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path><circle cx="12" cy="12" r="3"></circle></svg>
              Settings
            </Link>        
          </nav>
        </div>
      </div>
      
      <div className="relative px-3 mb-3">
        <div className="w-full border-t border-gray-200 p-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white overflow-hidden">
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-medium">
                  {user?.email ? user.email.charAt(0).toUpperCase() : "U"}
                </span>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white truncate max-w-[150px]">
                {user?.user_metadata?.name || user?.email?.split('@')[0] || "User"}
              </p>
              <p className="text-xs text-white truncate max-w-[150px]">
                {user?.email || "user@example.com"}
              </p>
            </div>
          </div>
        </div>
      </div>
    
    </aside>
  );
}

