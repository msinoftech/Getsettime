"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCreateBookingModal } from "@/src/providers/CreateBookingModalProvider";

function pathnameToActiveMenu(pathname: string): string {
  if (pathname === "/") return "dashboard";
  const paths: Record<string, string> = {
    "/bookings": "bookings",
    "/calendar": "calendar",
    "/event-type": "event-type",
    "/availability": "availability",
    "/intakeform": "intakeform",
    "/departments": "departments",
    "/services": "services",
    "/team-members": "team-members",
    "/integrations": "integrations",
    "/roles-permissions": "roles-permissions",
    "/contacts": "contacts",
    "/settings": "settings",
    "/profile": "profile",
    "/more": "more",
  };
  for (const [path, menu] of Object.entries(paths)) {
    if (pathname === path || pathname.startsWith(path + "/")) return menu;
  }
  return "";
}

function NavItem({
  href,
  label,
  isActive,
  icon,
}: {
  href: string;
  label: string;
  isActive: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors ${ isActive ? "text-indigo-600" : "text-gray-600 hover:text-gray-900"}`} aria-current={isActive ? "page" : undefined}>
      <span className={`h-6 w-6 ${isActive ? "text-indigo-600" : "text-gray-700"}`}>{icon}</span>
      <span>{label}</span>
      {isActive && (
        <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-indigo-600" />
      )}
    </Link>
  );
}

export default function BottomBar() {
  const { open: open_create_booking } = useCreateBookingModal();
  const pathname = usePathname();
  const activeMenu = pathnameToActiveMenu(pathname);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-999 border-t border-gray-200 bg-white lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Main navigation"
    >
      <div className="flex h-16 items-stretch">
        <NavItem
          href="/"
          label="Home"
          isActive={activeMenu === "dashboard"}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
              <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5A.75.75 0 0 0 13.5 15h-3a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 1-.75.75H4.875c-1.035 0-1.875-.84-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" />
            </svg>
          }
        />
        
        <NavItem
          href="/bookings"
          label="Bookings"
          isActive={activeMenu === "bookings"}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
              <path d="M8 2v4" />
              <path d="M16 2v4" />
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <path d="M3 10h18" />
              <path d="M8 14h.01" />
              <path d="M12 14h.01" />
              <path d="M16 14h.01" />
              <path d="M8 18h.01" />
              <path d="M12 18h.01" />
              <path d="M16 18h.01" />
            </svg>
          }
        />

        <button 
         type="button" 
         onClick={open_create_booking} 
         className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors text-gray-600 hover:text-gray-900`} 
         aria-label="Create Booking">
          <span className={`h-10 w-10 bg-indigo-600 text-white rounded-full flex items-center justify-center`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          </span>
        </button>

        <NavItem
          href="/calendar"
          label="Calendar"
          isActive={activeMenu === "calendar"}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <path d="M16 2v4" />
              <path d="M3 10h18" />
              <path d="M8 2v4" />
              <path d="M17 14h-6" />
              <path d="M13 18H7" />
            </svg>
          }
        />

        <NavItem
          href="/more"
          label="More"
          isActive={activeMenu === "more"}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h16" />
            </svg>
          }
        />
      </div>
    </nav>
  );
}
