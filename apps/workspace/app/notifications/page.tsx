"use client";

import { Suspense } from "react";
import { IntegrationsNotificationsView } from "@/src/components/workspace/IntegrationsNotificationsView";
import { IntegrationsSkeleton } from "@/src/components/ui/IntegrationsSkeleton";

export default function NotificationsPage() {
  return (
    <Suspense fallback={<IntegrationsSkeleton withHeader />}>
      <IntegrationsNotificationsView />
    </Suspense>
  );
}
