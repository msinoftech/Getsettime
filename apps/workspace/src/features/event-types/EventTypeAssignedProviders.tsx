"use client";

import { WorkspaceUserAvatar } from "@/src/components/User/WorkspaceUserAvatar";
import {
  capitalize_booking_display_label,
  getServiceProviderName,
} from "@/src/utils/booking";
import type { ServiceProvider } from "@/src/types/booking-entities";
import {
  eventTypeAssignedProviderIds,
  type event_type_assignment_fields,
} from "@/src/utils/bookingFormUtils";

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function resolve_provider_label(
  providerId: string,
  serviceProviders: ServiceProvider[],
  owner_names_by_id: Record<string, string> | undefined,
  show_owner_labels: boolean
): string {
  if (show_owner_labels && owner_names_by_id?.[providerId]) {
    return owner_names_by_id[providerId];
  }
  const name = capitalize_booking_display_label(
    getServiceProviderName(providerId, serviceProviders)
  );
  return name === "N/A" ? "—" : name;
}

type EventTypeAssignedProvidersProps = {
  eventType: event_type_assignment_fields;
  serviceProviders: ServiceProvider[];
  owner_names_by_id?: Record<string, string>;
  show_owner_labels?: boolean;
  size?: "sm" | "md";
  className?: string;
  /** When true, multiple providers share one row with comma-separated names. */
  compact?: boolean;
};

export function EventTypeAssignedProviders({
  eventType,
  serviceProviders,
  owner_names_by_id,
  show_owner_labels = false,
  size = "sm",
  className,
  compact = false,
}: EventTypeAssignedProvidersProps) {
  const provider_ids = eventTypeAssignedProviderIds(eventType);

  if (provider_ids.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-sm text-slate-700",
          className
        )}
      >
        <WorkspaceUserAvatar name="Provider" userId={undefined} size={size} />
        <span className="truncate">—</span>
      </div>
    );
  }

  const labels = provider_ids.map((id) =>
    resolve_provider_label(
      id,
      serviceProviders,
      owner_names_by_id,
      show_owner_labels
    )
  );

  if (provider_ids.length === 1) {
    const label = labels[0];
    const provider_id = provider_ids[0];
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-sm text-slate-700",
          className
        )}
      >
        <WorkspaceUserAvatar
          name={label === "—" ? "Provider" : label}
          userId={provider_id}
          size={size}
        />
        <span className="truncate">{label}</span>
      </div>
    );
  }

  if (compact) {
    const visible_ids = provider_ids.slice(0, 3);
    const extra = provider_ids.length - visible_ids.length;
    return (
      <div
        className={cn(
          "flex min-w-0 items-center gap-2 text-sm text-slate-700",
          className
        )}
        title={labels.join(", ")}
      >
        <div className="flex shrink-0 -space-x-2">
          {visible_ids.map((id, index) => (
            <WorkspaceUserAvatar
              key={id}
              name={labels[index] === "—" ? "Provider" : labels[index]}
              userId={id}
              size={size}
            />
          ))}
        </div>
        <span className="truncate">
          {labels.join(", ")}
          {extra > 0 ? ` +${extra}` : ""}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 text-sm text-slate-700",
        className
      )}
    >
      {provider_ids.map((id, index) => {
        const label = labels[index];
        return (
          <div key={id} className="flex min-w-0 items-center gap-2">
            <WorkspaceUserAvatar
              name={label === "—" ? "Provider" : label}
              userId={id}
              size={size}
            />
            <span className="truncate">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
