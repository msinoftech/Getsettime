"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "../../providers/AuthProvider";

import { FcHome } from "react-icons/fc";
import { FcBriefcase } from "react-icons/fc";
import { FcPlanner } from "react-icons/fc";
import { FcAutomatic } from "react-icons/fc";
import { FcBusinessman } from "react-icons/fc";

interface SidebarProps {
  isOpen: boolean;
}

export default function Sidebar({ isOpen }: SidebarProps) {
  const [activeMenu, setActiveMenu] = useState("");
  const { user } = useAuth();

  return (
    <aside className={`bg-white border-r border-gray-200 fixed top-0 left-0 z-40 h-screen w-64 transition-transform duration-300 ease-in-out ${ isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} shadow-lg`}>
      <div className="h-16 px-3 flex items-center justify-start border-b border-gray-200">
        <Link href="/" className="logo w-full relative">
          <Image src="/getsettime-logo.svg" alt="GetSetTime Logo" width={150} height={40} />
          <span className="text-xs flex justify-end absolute right-0 bottom-0 text-indigo-600">Superadmin</span>
        </Link>
      </div>

      <div className="py-6 px-3">
        <nav className="space-y-1">
          <Link href="/" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${activeMenu === "dashboard" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50"}`} onClick={() => setActiveMenu("dashboard")}>
            <FcHome className="h-5 w-5 mr-3" />
            Dashboard
          </Link>
          
          <Link href="/users" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "users" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={() => setActiveMenu("users")}>
            <FcBusinessman className="h-5 w-5 mr-3" />
            Users
          </Link>    
          
          <Link href="/workspaces" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "workspaces" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={() => setActiveMenu("workspaces")}>
            <FcBriefcase className="h-5 w-5 mr-3" />
            Workspaces
          </Link>        
          
          <Link href="/bookings" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "bookings" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={() => setActiveMenu("bookings")}>
            <FcPlanner className="h-5 w-5 mr-3" />
            All Bookings
          </Link>        
          
          <Link href="/settings" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "settings" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={() => setActiveMenu("settings")}>
            <FcAutomatic className="h-5 w-5 mr-3" />
            Settings
          </Link>        
        </nav>
      </div>

      <div className="absolute bottom-0 w-full border-t border-gray-200 p-4">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
            <span className="text-sm font-medium">
              {user?.email ? user.email.charAt(0).toUpperCase() : "SA"}
            </span>
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