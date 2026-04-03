"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import { useWorkspaceSettings } from "../../hooks/useWorkspaceSettings";

interface TopbarProps {
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
}

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
}

function getRelativeTime(dateIso: string) {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Topbar({ toggleSidebar, isSidebarOpen }: TopbarProps) {
  const PROFILE_IMAGE_STORAGE_KEY = "workspace_profile_image";
  const PROFILE_IMAGE_EVENT = "workspace-profile-image-updated";
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  const { general, loading: loadingSettings, workspaceProfessionLabel } = useWorkspaceSettings();

  const logoUrl = general.logoUrl || "/getsettime-logo.svg";
  const accountName = general.accountName || "GetSetTime";
  const isExternalUrl = logoUrl?.startsWith('http://') || logoUrl?.startsWith('https://');
  
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };
  
  // Close dropdowns when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as Node;

    const notificationButton = document.getElementById('notification-button');
    const notificationDropdown = document.getElementById('notification-dropdown');
    const profileButton = document.getElementById('profile-button');
    const profileDropdown = document.getElementById('profile-dropdown');

    const isClickInsideNotification =
      (notificationButton && notificationButton.contains(target)) ||
      (notificationDropdown && notificationDropdown.contains(target));

    const isClickInsideProfile =
      (profileButton && profileButton.contains(target)) ||
      (profileDropdown && profileDropdown.contains(target));

    // If the click is outside both areas, close both dropdowns
    if (!isClickInsideNotification && !isClickInsideProfile) {
      setIsProfileMenuOpen(false);
      setIsNotificationOpen(false);
    }
  };

  // Use useEffect to add event listener for clicks outside the dropdown
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  useEffect(() => {
    if (!isNotificationOpen) return;
    let alive = true;

    const loadNotifications = async () => {
      setNotificationsLoading(true);
      setNotificationsError(null);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          if (alive) setNotifications([]);
          return;
        }

        const response = await fetch("/api/activity", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error || "Failed to load notifications");
        }

        const body = await response.json();
        const activities = (body?.activities || []) as NotificationItem[];
        if (alive) {
          setNotifications(activities.slice(0, 5));
        }
      } catch (error) {
        if (alive) {
          setNotificationsError(error instanceof Error ? error.message : "Failed to load notifications");
        }
      } finally {
        if (alive) setNotificationsLoading(false);
      }
    };

    loadNotifications();
    const interval = window.setInterval(loadNotifications, 30000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [isNotificationOpen]);

  // Prevent clicks inside the dropdown from closing it
  const handleDropdownClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center px-4">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center">
          <button onClick={toggleSidebar} className="p-2 rounded-md text-gray-500 hover:bg-gray-100 lg:hidden" aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isSidebarOpen ? (
                <path strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              ) : (
                <path strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
              )}
            </svg>
          </button>
          
          <div className="lg:hidden">
            <Link href="/" className="flex items-center gap-1">
              {!loadingSettings && (
                <>
                  {isExternalUrl ? (
                    <img 
                      src={logoUrl} 
                      alt={`${accountName} Logo`} 
                      className="h-8 w-auto object-contain"
                    />
                  ) : (
                    <Image 
                      src={logoUrl} 
                      alt={`${accountName} Logo`} 
                      width={120} 
                      height={30} 
                      className="h-8 w-auto"
                    />
                  )}
                  {accountName && accountName !== "GetSetTime" && (
                    <span className="text-sm sm:text-md font-bold text-gray-700">
                      {accountName}
                    </span>
                  )}
                </>
              )}
            </Link>
          </div>
        </div>

        {/* Center section - can be used for search or other elements */}
        <div className="hidden md:flex flex-1 justify-center">
          <div className="relative max-w-md w-full">
            <input type="text" placeholder="Search..." className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
            <div className="absolute left-3 top-2.5 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
          </div>
        </div>

        {!loadingSettings && workspaceProfessionLabel ? (
          <div className="hidden sm:flex items-center max-w-[11rem] md:max-w-[16rem] shrink-0 px-2">
            <div
              className="text-sm truncate rounded-lg border-2 border-indigo-700/80 px-3 py-1.5 shadow-sm"
              style={{ backgroundColor: "var(--color-indigo-600)" }}
              title={workspaceProfessionLabel}
            >
              <span className="text-white/90 font-normal mr-1.5">Profession</span>
              <span className="font-bold text-white">{workspaceProfessionLabel}</span>
            </div>
          </div>
        ) : null}

        {/* Right section with user profile */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <button id="notification-button" onClick={(e) => { e.stopPropagation(); setIsNotificationOpen(!isNotificationOpen); setIsProfileMenuOpen(false);}} className="p-2 bg-gray-100 rounded-full text-gray-500 cursor-pointer hover:bg-gray-100 relative" aria-label="Notifications" aria-expanded={isNotificationOpen} aria-haspopup="true">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
              <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
            </button>
            
            {isNotificationOpen && (
              <div id="notification-dropdown" className="absolute right-0 w-80 bg-white rounded-md shadow-lg overflow-hidden z-50 border border-gray-200">
                <div className="bg-indigo-600 text-white px-4 py-2 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-white">Notifications</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notificationsLoading ? (
                    <div className="px-4 py-3 text-xs text-gray-500">Loading notifications...</div>
                  ) : notificationsError ? (
                    <div className="px-4 py-3 text-xs text-red-600">{notificationsError}</div>
                  ) : notifications.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-gray-500">No recent activity</div>
                  ) : (
                    notifications.map((item, index) => (
                      <div
                        key={item.id}
                        className={`px-4 py-3 hover:bg-gray-50 ${
                          index !== notifications.length - 1 ? "border-b border-gray-100" : ""
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-700">{item.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                        <p className="text-xs text-gray-400 mt-1">{getRelativeTime(item.createdAt)}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="px-4 py-2 border-t border-gray-100 text-center">
                  <Link href="/notifications/all" className="text-xs text-blue-600 hover:text-blue-800" onClick={() => setIsNotificationOpen(false)}>View all notifications</Link>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button id="profile-button" onClick={(e) => { e.stopPropagation(); setIsProfileMenuOpen(!isProfileMenuOpen); setIsNotificationOpen(false);}} className="flex items-center space-x-2 cursor-pointer focus:outline-none" aria-expanded={isProfileMenuOpen} aria-haspopup="true">
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white overflow-hidden">
                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-medium">{user?.email ? user.email.charAt(0).toUpperCase() : "U"}</span>
                )}
              </div>
            </button>

            {isProfileMenuOpen && (
              <div id="profile-dropdown" className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                {user && (
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs text-gray-500">Signed in as</p>
                    <p className="text-sm font-medium text-gray-700 truncate">{user.email}</p>
                  </div>
                )}
                <Link href="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setIsProfileMenuOpen(false)}>Your Profile</Link>
                <Link href="/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setIsProfileMenuOpen(false)}>Settings</Link>
                <div className="border-t border-gray-100 my-1"></div>
                <button onClick={handleSignOut} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Sign out</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

