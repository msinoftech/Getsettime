"use client";

import { useCallback, useState } from "react";
import {
  ServiceFormPanel,
  type service_form_saved_result,
} from "@/src/features/services/ServiceFormPanel";
import type {
  service_department_option,
  service_name_record,
} from "@/src/features/services/service_records";
import { useServiceDepartmentDoctors } from "@/src/features/services/useServiceDepartmentDoctors";

export type event_type_created_service = {
  id: string;
  name: string;
  department_id: number | null;
};

export type EventTypeAddServicePanelProps = {
  /** Department the new service is created in; rendered read-only. */
  department: service_department_option;
  /** Services already loaded by the event type form, for duplicate-name checks. */
  existing_services: readonly service_name_record[];
  on_close: () => void;
  on_created: (created: event_type_created_service) => void | Promise<void>;
};

/**
 * Inline service creation for the event type form. Mounted only while the nested
 * panel is open so the consultant lookups are not fetched otherwise.
 */
export function EventTypeAddServicePanel({
  department,
  existing_services,
  on_close,
  on_created,
}: EventTypeAddServicePanelProps) {
  const [error_message, set_error_message] = useState<string | null>(null);
  const { resolve, loading } = useServiceDepartmentDoctors();

  const handle_saved = useCallback(
    async ({ service }: service_form_saved_result) => {
      set_error_message(null);
      await on_created({
        id: service.id,
        name: service.name,
        department_id: service.department_id,
      });
    },
    [on_created]
  );

  return (
    <ServiceFormPanel
      mode="add"
      departments={[department]}
      existing_services={existing_services}
      initial_department_id={department.id}
      lock_department
      resolve_department_doctors={resolve}
      doctors_loading={loading}
      error_message={error_message}
      on_error={set_error_message}
      on_cancel={on_close}
      on_saved={handle_saved}
    />
  );
}
