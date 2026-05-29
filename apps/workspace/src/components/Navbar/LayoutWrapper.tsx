"use client";
import { AuthProvider, useAuth } from "../../providers/AuthProvider";
import {
  CreateBookingModalHost,
  CreateBookingModalProvider,
} from "../../providers/CreateBookingModalProvider";
import { WorkspaceSettingsProvider } from "../../providers/WorkspaceSettingsProvider";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Sidebar from "../Sidebar/Sidebar";
import Topbar from "./Topbar";
import { is_public_embed_booking_path } from "@/lib/public_embed_route";

// Public routes that don't require authentication or sidebar
const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password", "/auth/login", "/auth/register", "/auth/forgot-password", "/auth/callback", "/invite-accept", "/my-bookings"];

function LayoutContent({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, loading } = useAuth();
  const pathname = usePathname();

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Close sidebar when click outside
  const closeSidebar = () => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  // Close sidebar when window is resized to desktop size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check if current route is public
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname) || is_public_embed_booking_path(pathname) || pathname.startsWith('/booking-preview/');

  // For public routes, just render children without authentication check
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Show loading state while checking authentication for protected routes
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Only render sidebar and topbar if user is authenticated
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center px-4 max-w-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" aria-hidden />
          <p className="mt-4 text-gray-700 font-medium">Redirecting to sign-in…</p>
          <p className="mt-2 text-sm text-gray-500">
            If you are not redirected,{" "}
            <Link href="/login" className="text-blue-600 underline hover:text-blue-800">
              open login
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <WorkspaceSettingsProvider>
    <CreateBookingModalProvider>
    <div className="flex min-h-screen relative w-full overflow-x-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-30 lg:hidden" onClick={closeSidebar} aria-hidden="true"/>
      )}
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
      <div className="flex-1 flex flex-col w-full min-w-0 ml-0 lg:ml-64 transition-all duration-300">
        <Topbar toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
        <main className="relative flex min-h-0 flex-1 flex-col w-full overflow-x-hidden bg-gray-100">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 lg:p-8">
            <div className="w-full max-w-full">
              {children}
            </div>
          </div>
          <CreateBookingModalHost />
        </main>
      </div>
    </div>
    </CreateBookingModalProvider>
    </WorkspaceSettingsProvider>
  );
}

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LayoutContent>{children}</LayoutContent>
    </AuthProvider>
  );
}

