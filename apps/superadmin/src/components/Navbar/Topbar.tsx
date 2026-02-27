"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

interface TopbarProps {
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export default function Topbar({ toggleSidebar, isSidebarOpen }: TopbarProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };
  
  // Close dropdowns when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    // Check if the click is outside the dropdown elements
    const notificationButton = document.getElementById('notification-button');
    const notificationDropdown = document.getElementById('notification-dropdown');
    const profileButton = document.getElementById('profile-button');
    const profileDropdown = document.getElementById('profile-dropdown');
    
    // If the click is outside both buttons and dropdowns, close them
    if (
      notificationButton && 
      notificationDropdown && 
      profileButton && 
      profileDropdown && 
      !notificationButton.contains(e.target as Node) && 
      !notificationDropdown.contains(e.target as Node) &&
      !profileButton.contains(e.target as Node) &&
      !profileDropdown.contains(e.target as Node)
    ) {
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
          
          <div className="lg:hidden ml-2">
            <Link href="/">
              <span className="text-xl font-bold text-blue-600">Superadmin</span>
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

        {/* Right section with user profile */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            <button id="notification-button" onClick={(e) => { e.stopPropagation(); setIsNotificationOpen(!isNotificationOpen); setIsProfileMenuOpen(false);}} className="p-2 rounded-full text-gray-500 cursor-pointer hover:bg-gray-100 relative" aria-label="Notifications" aria-expanded={isNotificationOpen} aria-haspopup="true">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
              <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
            </button>
            
            {isNotificationOpen && (
              <div id="notification-dropdown" className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                <div className="px-4 py-2 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700">Notifications</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <div className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
                    <p className="text-sm font-medium text-gray-700">System Alert</p>
                    <p className="text-xs text-gray-500 mt-1">System maintenance scheduled</p>
                    <p className="text-xs text-gray-400 mt-1">10 minutes ago</p>
                  </div>
                </div>
                <div className="px-4 py-2 border-t border-gray-100 text-center">
                  <Link href="/notifications" className="text-xs text-blue-600 hover:text-blue-800">View all notifications</Link>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button id="profile-button" onClick={(e) => { e.stopPropagation(); setIsProfileMenuOpen(!isProfileMenuOpen); setIsNotificationOpen(false);}} className="flex items-center space-x-2 cursor-pointer focus:outline-none" aria-expanded={isProfileMenuOpen} aria-haspopup="true">
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                <span className="text-sm font-medium">{user?.email ? user.email.charAt(0).toUpperCase() : "SA"}</span>
              </div>
            </button>

            {isProfileMenuOpen && (
              <div id="profile-dropdown" className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                {user && (
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs text-gray-500">Signed in as</p>
                    <p className="text-sm font-medium text-gray-700 truncate">{user.email}</p>
                    <p className="text-xs text-blue-600 font-semibold mt-1">Superadmin</p>
                  </div>
                )}
                <Link href="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Your Profile</Link>
                <Link href="/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Settings</Link>
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