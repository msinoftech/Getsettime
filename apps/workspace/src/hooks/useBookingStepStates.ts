import { useMemo } from 'react';
import type { Department, EventType, ServiceProvider } from '@/src/types/bookingForm';
import {
  department_provider_step_state,
  event_type_step_is_ready,
  event_type_step_state,
  type booking_step_id,
  type booking_step_states,
} from '@/src/features/booking-flow';
import { resolve_provider_scoped_service_gate } from '@/src/utils/provider_scoped_service_gate';
import type { Service } from '@/src/types/bookingForm';

type UseBookingStepStatesParams = {
  step_order: readonly booking_step_id[];
  loadingEventTypes: boolean;
  eventTypesCount: number;
  selectedType: EventType | null;
  departmentsCount: number;
  loadingDepartments: boolean;
  selectedDepartment: Department | null;
  showProviderPicker: boolean;
  serviceProvidersCount: number;
  loadingProviders: boolean;
  selectedProvider: ServiceProvider | null;
  providerCatalogContextReady: boolean;
  loadingProviderScopedCatalog: boolean;
  providerScopedCatalogServices: Service[];
  providerScopedCatalogSettled: boolean;
  selectedServiceIds: string[];
};

export function useBookingStepStates(params: UseBookingStepStatesParams): booking_step_states {
  const event_type_context_ready = event_type_step_is_ready(params.step_order, {
    departmentsCount: params.departmentsCount,
    hasSelectedDepartment: !!params.selectedDepartment,
    showProviderPicker: params.showProviderPicker,
    hasSelectedProvider: !!params.selectedProvider,
  });

  const serviceGate = useMemo(
    () =>
      resolve_provider_scoped_service_gate(
        params.providerScopedCatalogServices,
        params.loadingProviderScopedCatalog,
        params.providerCatalogContextReady,
        params.providerScopedCatalogSettled
      ),
    [
      params.providerScopedCatalogServices,
      params.loadingProviderScopedCatalog,
      params.providerCatalogContextReady,
      params.providerScopedCatalogSettled,
    ]
  );

  return useMemo<booking_step_states>(
    () => ({
      event_type: event_type_step_state({
        loadingEventTypes: params.loadingEventTypes,
        eventTypesCount: params.eventTypesCount,
        hasSelectedType: !!params.selectedType,
        contextReady: event_type_context_ready,
      }),
      department_provider: department_provider_step_state({
        order: params.step_order,
        selectedType: params.selectedType,
        departmentsCount: params.departmentsCount,
        loadingDepartments: params.loadingDepartments,
        hasSelectedDepartment: !!params.selectedDepartment,
        showProviderPicker: params.showProviderPicker,
        serviceProvidersCount: params.serviceProvidersCount,
        loadingProviders: params.loadingProviders,
        hasSelectedProvider: !!params.selectedProvider,
        providerCatalogContextReady: params.providerCatalogContextReady,
        serviceCatalogReady: serviceGate.catalogReady,
        serviceRequiresManualSelection: serviceGate.requiresManualSelection,
        serviceCatalogCount: params.providerScopedCatalogServices.length,
        hasSoleServiceSelected:
          serviceGate.soleServiceId != null
            ? params.selectedServiceIds.includes(serviceGate.soleServiceId)
            : params.providerCatalogContextReady && serviceGate.catalogReady,
      }),
    }),
    [
      params.step_order,
      params.loadingEventTypes,
      params.eventTypesCount,
      params.selectedType,
      event_type_context_ready,
      params.departmentsCount,
      params.loadingDepartments,
      params.selectedDepartment,
      params.showProviderPicker,
      params.serviceProvidersCount,
      params.loadingProviders,
      params.selectedProvider,
      params.providerCatalogContextReady,
      serviceGate,
      params.providerScopedCatalogServices.length,
      params.selectedServiceIds,
    ]
  );
}
