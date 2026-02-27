"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "../../providers/AuthProvider";
import { useWorkspaceSettings } from "../../hooks/useWorkspaceSettings";

import {
  FcHome,
  FcPlanner,
  FcOvertime,
  FcAlarmClock,
  FcBusinessman,
  FcCrystalOscillator,
  FcOrgUnit,
  FcCollaboration,
  FcCurrencyExchange,
  FcSettings,
  FcAddressBook,
  FcList,
  FcOrganization,
  FcHighBattery,
} from "@/src/icons/sidebar-icons";

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
  const [isDepartmentsOpen, setIsDepartmentsOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();
  const { general, loading: loadingConfig, workspaceName, workspaceLogo } = useWorkspaceSettings();

  const activeMenu = pathnameToActiveMenu(pathname);

  const logoUrl = workspaceLogo || "/getsettime-logo.svg";
  const accountName = workspaceName || "GetSetTime";
  const isExternalUrl = logoUrl?.startsWith('http://') || logoUrl?.startsWith('https://');

  const handleNavClick = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      onClose?.();
    }
  };

  // Auto-expand departments submenu if on departments or services page
  useEffect(() => {
    if (pathname === "/departments" || pathname === "/services") {
      setIsDepartmentsOpen(true);
    } else {
      setIsDepartmentsOpen(false);
    }
  }, [pathname]);

  return (
    <aside className={`bg-white border-r border-gray-200 fixed top-0 left-0 z-40 h-screen w-64 transition-transform duration-300 ease-in-out ${ isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} shadow-lg`}>
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
                <span className="text-sm font-semibold text-gray-700 truncate max-w-[100px]">
                  {accountName}
                </span>
              )}
            </>
          )}
        </Link>
      </div>

      <div className="py-6 px-3">
        <nav className="space-y-1">
          <Link href="/" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${activeMenu === "dashboard" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50"}`} onClick={handleNavClick}>
            <FcHome className="h-5 w-5 mr-3" />
            Dashboard
          </Link>
          <Link href="/event-type" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "event-type" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <FcOvertime className="h-5 w-5 mr-3" />
            Event Type
          </Link> 
          <Link href="/bookings" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "bookings" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <FcPlanner className="h-5 w-5 mr-3" />
            Bookings
          </Link>
          <Link href="/emergency-booking" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "emergency-booking" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <FcHighBattery className="h-5 w-5 mr-3" />
            Emergency Booking
          </Link>
          <Link href="/availability" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "availability" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <FcAlarmClock className="h-5 w-5 mr-3" />
            Availability
          </Link>        
          <Link href="/intakeform" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "intakeform" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <svg className="h-7 w-7 mr-2" viewBox="-2.4 -2.4 28.80 28.80" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M16.5 4.25C18.8472 4.25 20.75 6.15279 20.75 8.5C20.75 10.8472 18.8472 12.75 16.5 12.75H7.5C5.98122 12.75 4.75 13.9812 4.75 15.5C4.75 17.0188 5.98122 18.25 7.5 18.25H18.1893L17.4697 17.5303C17.1768 17.2374 17.1768 16.7626 17.4697 16.4697C17.7626 16.1768 18.2374 16.1768 18.5303 16.4697L20.5303 18.4697C20.8232 18.7626 20.8232 19.2374 20.5303 19.5303L18.5303 21.5303C18.2374 21.8232 17.7626 21.8232 17.4697 21.5303C17.1768 21.2374 17.1768 20.7626 17.4697 20.4697L18.1893 19.75H7.5C5.15279 19.75 3.25 17.8472 3.25 15.5C3.25 13.1528 5.15279 11.25 7.5 11.25H16.5C18.0188 11.25 19.25 10.0188 19.25 8.5C19.25 6.98122 18.0188 5.75 16.5 5.75H7.85462C7.55793 6.48296 6.83934 7 6 7C4.89543 7 4 6.10457 4 5C4 3.89543 4.89543 3 6 3C6.83934 3 7.55793 3.51704 7.85462 4.25H16.5Z" fill="#1C274C"></path> </g></svg>
            Forms
          </Link>
          {/* Departments with Services submenu */}
          <div>
            <button
              onClick={() => setIsDepartmentsOpen(!isDepartmentsOpen)}
              className={`group w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "departments" || activeMenu === "services" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`}
            >
              <div className="flex items-center">
                <FcOrganization className="h-5 w-5 mr-3" />
                Departments
              </div>
              <svg
                className={`h-4 w-4 transition-transform ${isDepartmentsOpen ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {isDepartmentsOpen && (
              <div className="ml-4 mt-1 space-y-1">
                <Link
                  href="/departments"
                  className={`block px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "departments" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50" }`}
                  onClick={handleNavClick}
                >
                  Departments
                </Link>
                <Link
                  href="/services"
                  className={`block px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "services" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50" }`}
                  onClick={handleNavClick}
                >
                  Services
                </Link>
              </div>
            )}
          </div>
          <Link href="/notifications" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "notifications" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <FcOrgUnit className="h-5 w-5 mr-3" />
            Notifications
          </Link>        
          <Link href="/integrations" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "integrations" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <FcCrystalOscillator className="h-5 w-5 mr-3" />
            Integrations
          </Link>        
          <Link href="/team-members" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "team-members" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <FcBusinessman className="h-5 w-5 mr-3" />
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
          <Link href="/contacts" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "contacts" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <FcAddressBook className="h-5 w-5 mr-3" />
            Contacts
          </Link>
          <Link href="/settings" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "settings" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={handleNavClick}>
            <FcSettings className="h-5 w-5 mr-3" />
            Settings
          </Link>        
        </nav>
      </div>

      <div className="bg-white absolute bottom-0 w-full border-t border-gray-200 p-4">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
            <span className="text-sm font-medium">
              {user?.email ? user.email.charAt(0).toUpperCase() : "U"}
            </span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-700 truncate max-w-[150px]">
              {user?.user_metadata?.name || user?.email?.split('@')[0] || "User"}
            </p>
            <p className="text-xs text-gray-500 truncate max-w-[150px]">
              {user?.email || "user@example.com"}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

