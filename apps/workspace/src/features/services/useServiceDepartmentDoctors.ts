"use client";

import { useCallback, useMemo } from "react";
import { provider_initials } from "@/src/features/departments/DepartmentPanelPrimitives";
import {
  useServiceProviders,
  useUserDepartments,
} from "@/src/hooks/useBookingLookups";
import { useAuth } from "@/src/providers/AuthProvider";
import type { ServiceProvider } from "@/src/types/booking-entities";
import type { service_doctor_row } from "@/src/features/services/service_records";

function provider_display_name(provider: ServiceProvider): string {
  return (
    provider.raw_user_meta_data?.full_name?.trim() ||
    provider.raw_user_meta_data?.name?.trim() ||
    provider.email ||
    "Unknown"
  );
}

export type service_department_doctors = {
  /** Consultants assigned to a department, i.e. the eligible pool for its services. */
  resolve: (departmentId: number | null) => service_doctor_row[];
  /** Department ids the signed-in user is assigned to. */
  department_ids_by_provider: Map<string, Set<number>>;
  providers: ServiceProvider[];
  loading: boolean;
  refetch: () => Promise<void>;
};

/**
 * Shared source of truth for the department consultant pool used by the service
 * form, so every host resolves the same eligible providers.
 */
export function useServiceDepartmentDoctors(): service_department_doctors {
  const { user } = useAuth();
  const { data: providers, loading: providers_loading } = useServiceProviders();
  const {
    byDepartment: providers_by_department_id,
    byUser: department_ids_by_provider,
    loading: departments_loading,
    refetch,
  } = useUserDepartments();

  const current_user_id = user?.id ?? null;
  const current_user_role =
    (user?.user_metadata?.role as string | undefined) ?? null;
  const is_logged_in_service_provider = current_user_role === "service_provider";

  const resolve = useCallback(
    (departmentId: number | null): service_doctor_row[] => {
      if (departmentId == null) return [];
      const assignedIds =
        providers_by_department_id.get(departmentId) ?? new Set<string>();
      const rows: service_doctor_row[] = providers
        .filter((provider) => assignedIds.has(provider.id))
        .map((provider) => {
          const name = provider_display_name(provider);
          return {
            id: provider.id,
            name,
            role: "Doctor",
            avatar: provider_initials(name),
            avatarUrl: provider.avatar_url?.trim() || null,
          };
        });

      // A provider viewing their own department may not be in the provider list yet.
      if (
        is_logged_in_service_provider &&
        current_user_id &&
        assignedIds.has(current_user_id) &&
        !rows.some((row) => row.id === current_user_id)
      ) {
        const meta = user?.user_metadata as
          | {
              full_name?: string;
              name?: string;
              avatar_url?: string;
              picture?: string;
            }
          | undefined;
        const name =
          meta?.full_name?.trim() || meta?.name?.trim() || user?.email || "You";
        const avatarUrl =
          (typeof meta?.avatar_url === "string" && meta.avatar_url.trim()) ||
          (typeof meta?.picture === "string" && meta.picture.trim()) ||
          null;
        rows.push({
          id: current_user_id,
          name,
          role: "Doctor",
          avatar: provider_initials(name),
          avatarUrl,
        });
      }

      return rows;
    },
    [
      providers,
      providers_by_department_id,
      is_logged_in_service_provider,
      current_user_id,
      user,
    ]
  );

  return useMemo(
    () => ({
      resolve,
      department_ids_by_provider,
      providers,
      loading: providers_loading || departments_loading,
      refetch,
    }),
    [
      resolve,
      department_ids_by_provider,
      providers,
      providers_loading,
      departments_loading,
      refetch,
    ]
  );
}
