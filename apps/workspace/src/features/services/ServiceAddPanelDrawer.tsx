"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ServiceFormPanel,
  type service_form_saved_result,
} from "@/src/features/services/ServiceFormPanel";
import type {
  service_department_option,
  service_name_record,
} from "@/src/features/services/service_records";
import { useServiceDepartmentDoctors } from "@/src/features/services/useServiceDepartmentDoctors";

export type ServiceAddPanelDrawerProps = {
  open: boolean;
  department: service_department_option | null;
  existing_services: readonly service_name_record[];
  on_close: () => void;
  on_saved: (result: service_form_saved_result) => void | Promise<void>;
};

/**
 * Slide-over host for {@link ServiceFormPanel} in add mode (locked department).
 * Same panel used on Services and Event Type flows.
 */
export function ServiceAddPanelDrawer({
  open,
  department,
  existing_services,
  on_close,
  on_saved,
}: ServiceAddPanelDrawerProps) {
  const [entered, setEntered] = useState(false);
  const [error_message, set_error_message] = useState<string | null>(null);
  const { resolve, loading } = useServiceDepartmentDoctors();

  useEffect(() => {
    if (!open) {
      setEntered(false);
      set_error_message(null);
      return;
    }
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const handle_saved = useCallback(
    async (result: service_form_saved_result) => {
      set_error_message(null);
      await on_saved(result);
    },
    [on_saved]
  );

  if (!open || !department) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close add service panel"
        onClick={on_close}
        className={`fixed inset-0 z-100001 cursor-default bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300 ease-in-out ${
          entered ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add service"
        className={`fixed top-0 right-0 bottom-0 z-100002 flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out will-change-transform md:w-[32rem] ${
          entered ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
        <ServiceFormPanel
          key={`add-service-dept-${department.id}`}
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
        </div>
      </div>
    </>
  );
}
