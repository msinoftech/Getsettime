"use client";
import { AuthProvider, useAuth } from "../../providers/AuthProvider";
import { WorkspaceSettingsProvider } from "../../providers/WorkspaceSettingsProvider";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "../Sidebar/Sidebar";
import Topbar from "./Topbar";

// Public routes that don't require authentication or sidebar
const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password", "/auth/login", "/auth/register", "/auth/forgot-password", "/auth/callback", "/invite-accept"];

// Reserved first path segments (app routes) - embed booking uses /[workspaceSlug] or /[workspaceSlug]/[eventTypeSlug]
const RESERVED_FIRST_SEGMENTS = ['login', 'register', 'forgot-password', 'reset-password', 'auth', 'invite-accept', 'event-type', 'intakeform', 'notifications', 'availability', 'team-members', 'departments', 'services', 'profile', 'integrations', 'contacts', 'billings', 'bookings', 'emergency-booking', 'settings', 'api', '_next'];
function isPublicRoutePattern(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  return (segments.length === 1 || segments.length === 2) && !RESERVED_FIRST_SEGMENTS.includes(segments[0]);
}

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
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname) || isPublicRoutePattern(pathname);

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
    return null; // AuthProvider will handle redirect to login
  }

  return (
    <WorkspaceSettingsProvider>
    <div className="flex min-h-screen relative w-full overflow-x-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-30 lg:hidden" onClick={closeSidebar} aria-hidden="true"/>
      )}
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
      <div className="flex-1 flex flex-col w-full min-w-0 ml-0 lg:ml-64 transition-all duration-300">
        <Topbar toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
        <main className="flex-1 p-4 lg:p-8 w-full max-w-full overflow-x-hidden bg-gray-100">
        <div className="w-full max-w-full">
          {children}
        </div>
        </main>
      </div>
    </div>
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

