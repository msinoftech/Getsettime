"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "../../providers/AuthProvider";

import {
  FcHome,
  FcBriefcase,
  FcPlanner,
  FcAutomatic,
  FcBusinessman,
  FcGraduationCap,
  FcOrgUnit,
} from "@app/icons";

const PATH_TO_MENU: Record<string, string> = {
  "/": "dashboard",
  "/users": "users",
  "/workspaces": "workspaces",
  "/professions": "professions",
  "/departments": "departments",
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
    <aside className={`bg-white border-r border-gray-200 fixed top-0 left-0 z-40 h-screen w-64 transition-transform duration-300 ease-in-out ${ isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} shadow-lg`}>
      <div className="h-16 px-3 flex items-center justify-start border-b border-gray-200">
        <Link href="/" className="logo w-full relative" onClick={handleNavClick}>
          <Image src="/getsettime-logo.svg" alt="GetSetTime Logo" width={150} height={40} />
          <span className="text-xs flex justify-end absolute right-0 bottom-0 text-indigo-600">Superadmin</span>
        </Link>
      </div>

      <div className="py-6 px-3">
        <nav className="space-y-1">
          <Link href="/" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${activeMenu === "dashboard" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50"}`} onClick={handleNavClick}>
            <FcHome className="h-5 w-5 mr-3" />
            Dashboard
          </Link>
          
          <Link href="/users" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "users" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <FcBusinessman className="h-5 w-5 mr-3" />
            Users
          </Link>    
          
          <Link href="/workspaces" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "workspaces" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <FcBriefcase className="h-5 w-5 mr-3" />
            Workspaces
          </Link>        
          
          <Link href="/professions" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "professions" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <FcGraduationCap className="h-5 w-5 mr-3" />
            Professions
          </Link>        

          <Link href="/departments" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "departments" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <FcOrgUnit className="h-5 w-5 mr-3" />
            Departments
          </Link>        
          
          <Link href="/bookings" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "bookings" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <FcPlanner className="h-5 w-5 mr-3" />
            All Bookings
            {newBookingsCount > 0 && (
              <span className="ml-auto inline-flex items-center justify-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white min-w-[20px]">
                {newBookingsCount}
              </span>
            )}
          </Link>        
          
          <Link href="/settings" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "settings" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <FcAutomatic className="h-5 w-5 mr-3" />
            Settings
          </Link>        
        </nav>
      </div>

      <div className="absolute bottom-0 w-full border-t border-gray-200 p-4">
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
            <p className="text-sm font-medium text-gray-700 truncate max-w-[150px]">
              {user?.user_metadata?.name || user?.email?.split('@')[0] || "Superadmin"}
            </p>
            <p className="text-xs text-gray-500 truncate max-w-[150px]">
              {user?.email || "admin@example.com"}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}