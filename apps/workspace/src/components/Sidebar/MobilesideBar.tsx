"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAuth } from "../../providers/AuthProvider";
import { useWorkspaceSettings } from "@/src/hooks/useWorkspaceSettings";
import { useSubscription } from "@/src/hooks/useSubscription";
import { formatRoleLabel, ROLE_STAFF } from "@/src/constants/roles";
import { UserAvatar } from "@app/ui";
import { useCurrentUserAvatar } from "@/src/hooks/useCurrentUserAvatar";

interface MenuItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

function ProgressRing({ percent, label }: { percent: number; label: string }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative h-12 w-12">
        <svg className="h-12 w-12 -rotate-90" viewBox="0 0 44 44" aria-hidden="true">
          <circle cx="22" cy="22" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="#6366f1"
            strokeWidth="3.5"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-900">
          {percent}%
        </span>
      </div>
      <span className={`text-xs font-medium ${percent >= 80 ? "text-emerald-600" : "text-amber-600"}`}>
        {label}
      </span>
    </div>
  );
}

function MenuRow({ item }: { item: MenuItem }) {
  return (
    <Link href={item.href} className="flex items-center gap-3 border-b border-gray-100 py-2 last:border-b-0 hover:bg-gray-50/80">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">{item.icon}</span>
      <span className="flex-1 text-sm text-gray-800">{item.label}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-neutral-600" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
    </Link>
  );
}

export default function MobileSidebar() {
  const { user } = useAuth();
  const { avatarUrl, displayName: currentUserDisplayName, email } = useCurrentUserAvatar();
  const { workspaceName, general, availability, loading: loadingSettings } = useWorkspaceSettings();
  const { data: subscription } = useSubscription();

  const isStaff = user?.user_metadata?.role === ROLE_STAFF;
  const role = (user?.user_metadata?.role as string | undefined) ?? undefined;

  const displayName =
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    (user?.user_metadata?.name as string | undefined)?.trim() ||
    user?.email?.split("@")[0] ||
    "Workspace";

  const accountName = workspaceName || general.accountName || "GetSetTime";
  const workspaceLabel = accountName.includes("Workspace")
    ? accountName
    : `${displayName}'s Workspace`;

  const planLabel = subscription?.plan?.name?.trim()
    ? `${subscription.plan.name} Plan`
    : "Free Plan";

  const roleLabel = role ? formatRoleLabel(role) : "Workspace Owner";

  const readinessPercent = useMemo(() => {
    if (loadingSettings) return 0;
    let score = 0;
    if (accountName && accountName !== "GetSetTime") score += 25;
    if (general.accountName || general.timezone) score += 25;
    if (availability && Object.keys(availability).length > 0) score += 25;
    if (subscription?.plan?.name) score += 25;
    return score;
  }, [accountName, general, availability, subscription, loadingSettings]);

  const readinessLabel = readinessPercent >= 80 ? "Ready" : "Setup";

  const appointmentItems: MenuItem[] = [
    {
      href: "/availability",
      label: "Availability",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-clock3 lucide-clock-3 h-4.5 w-4.5" aria-hidden="true" data-source-pos="107:20-107:52" data-source-name="Icon"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6h4"></path></svg>
      ),
    },
  ];

  const setupItems: MenuItem[] = [
    {
      href: "/event-type",
      label: "Event Types",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-book-open h-4.5 w-4.5" aria-hidden="true" data-source-pos="107:20-107:52" data-source-name="Icon"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg>
      ),
    },
    {
      href: "/intakeform",
      label: "Forms",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-rectangle-ellipsis h-4.5 w-4.5" aria-hidden="true" data-source-pos="107:20-107:52" data-source-name="Icon"><rect width="20" height="12" x="2" y="6" rx="2"></rect><path d="M12 12h.01"></path><path d="M17 12h.01"></path><path d="M7 12h.01"></path></svg>
      ),
    },
    {
      href: "/departments",
      label: "Departments",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-building2 lucide-building-2 h-4.5 w-4.5" aria-hidden="true" data-source-pos="107:20-107:52" data-source-name="Icon"><path d="M10 12h4"></path><path d="M10 8h4"></path><path d="M14 21v-3a2 2 0 0 0-4 0v3"></path><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"></path><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"></path></svg>
      ),
    },
    {
      href: "/services",
      label: "Services",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-life-buoy-icon lucide-life-buoy"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/></svg>
      ),
    },
  ];

  const admincenterItems: MenuItem[] = [
    {
      href: "/team-members",
      label: "Team Members",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-users h-4.5 w-4.5" aria-hidden="true" data-source-pos="107:20-107:52" data-source-name="Icon"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><path d="M16 3.128a4 4 0 0 1 0 7.744"></path><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><circle cx="9" cy="7" r="4"></circle></svg>
      ),
    },
    {
      href: "/integrations",
      label: "Workflow Integrations",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M15.5 2H8.6c-.4 0-.8.2-1.1.5-.3.3-.5.7-.5 1.1v16.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8c.4 0 .8-.2 1.1-.5.3-.3.5-.7.5-1.1V6.5L15.5 2z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="M10 12h4" />
          <path d="M10 16h4" />
        </svg>
      ),
    },
    {
      href: "/contacts",
      label: "Contacts",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-contact h-4.5 w-4.5" aria-hidden="true" data-source-pos="107:20-107:52" data-source-name="Icon"><path d="M16 2v2"></path><path d="M7 22v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"></path><path d="M8 2v2"></path><circle cx="12" cy="11" r="3"></circle><rect x="3" y="4" width="18" height="18" rx="2"></rect></svg>
      ),
    },
    {
      href: "/settings",
      label: "Settings",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
  ];

  // const intelligenceItems: MenuItem[] = [
  //   {
  //     href: "/integrations",
  //     label: "Workspace Health",
  //     icon: (
  //       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
  //         <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
  //       </svg>
  //     ),
  //   },
  //   {
  //     href: "/settings",
  //     label: "AI Setup Assistant",
  //     icon: (
  //       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
  //         <path d="m15 4 1 1 1-1" />
  //         <path d="m15 4-1 1-1-1" />
  //         <path d="M9 20h6" />
  //         <path d="M12 20V8" />
  //         <path d="m6.5 8 1.5-3 1.5 3" />
  //         <path d="m15.5 8-1.5-3-1.5 3" />
  //       </svg>
  //     ),
  //   },
  //   {
  //     href: "/bookings/new",
  //     label: "Quick Book with AI",
  //     icon: (
  //       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
  //         <path d="M12 7v14" />
  //         <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
  //       </svg>
  //     ),
  //   },
  // ];

  const sections: MenuSection[] = [{ title: "Appointments", items: appointmentItems }];
  if (!isStaff) {
    sections.push(
      { title: "Setup", items: setupItems },
      { title: "Admin Center", items: admincenterItems },
      // { title: "Intelligence", items: intelligenceItems }
    );
  }

  return (
    <div className="-mx-4 -my-4 overflow-y-auto bg-slate-50 lg:-mx-8 lg:-my-8">
      <div className="space-y-2.5 px-4 py-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">More</h1>
          <p className="text-sm text-slate-500">Manage your workspace and settings.</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-2.5 shadow-sm">
          <div className="flex items-center gap-3">
            <UserAvatar
              avatarUrl={avatarUrl}
              name={currentUserDisplayName}
              email={email ?? undefined}
              size="lg"
              className="bg-indigo-600 text-white"
            />
            <div className="min-w-0 flex-1">
              <Link href="/settings" className="flex items-center gap-1">
                <span className="truncate text-sm font-medium text-neutral-900">{workspaceLabel}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-neutral-600" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
              <div className="mt-0.5 flex flex-wrap gap-1.5">
                <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                  {planLabel}
                </span>
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                  {roleLabel}
                </span>
              </div>
            </div>
            <ProgressRing percent={readinessPercent} label={readinessLabel} />
          </div>
        </div>

        {sections.map((section) => (
          <div key={section.title} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <p className="mb-1 text-xs font-medium uppercase text-neutral-500">{section.title}</p>
            <div className="overflow-hidden">
              {section.items.map((item) => (
                <MenuRow key={`${section.title}-${item.label}`} item={item} />
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-indigo-600 shadow-sm">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-headset-icon lucide-headset h-4.5 w-4.5"><path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/></svg>
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-neutral-900">Need help?</p>
              <p className="text-xs text-neutral-600">Visit our Help Center or contact support for assistance.</p>
            </div>
            <Link href="" target="_blank" className="shrink-0 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
