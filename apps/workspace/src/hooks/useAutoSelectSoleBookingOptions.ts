import { useLayoutEffect, useRef } from 'react';
import type {
  Department,
  EventType,
  Service,
  ServiceProvider,
} from '@/src/types/bookingForm';
import { resolve_provider_scoped_service_gate } from '@/src/utils/provider_scoped_service_gate';

type UseAutoSelectSoleBookingOptionsParams = {
  /** Gates department, provider, and service auto-select (may wait for event-type-first). */
  enabled: boolean;
  /**
   * Gates sole event-type auto-select separately. When event-type is the first step,
   * `enabled` stays false until a type is chosen — so this must not use that flag.
   */
  autoSelectEventTypeEnabled?: boolean;
  loadingDepartments: boolean;
  departments: Department[];
  selectedDepartment: Department | null;
  setSelectedDepartment: (dept: Department | null) => void;
  setSelectedProvider: (provider: ServiceProvider | null) => void;
  selectedProvider: ServiceProvider | null;
  showProviderPicker: boolean;
  serviceProviders: ServiceProvider[];
  onClearOptionalServices?: () => void;
  loadingProviderScopedCatalog?: boolean;
  providerScopedCatalogServices?: Service[];
  providerCatalogContextReady?: boolean;
  providerScopedCatalogSettled?: boolean;
  onAutoSelectSingleService?: (id: string) => void;
  loadingEventTypes?: boolean;
  eventTypes?: EventType[];
  selectedType?: EventType | null;
  setSelectedType?: (type: EventType | null) => void;
  eventTypeContextReady?: boolean;
};

/**
 * Applies the only available department, provider, and service so steps with no
 * genuine choice can be skipped. Runs regardless of which step is showing, and
 * leaves navigation to the configured step order.
 */
export function useAutoSelectSoleBookingOptions({
  enabled,
  autoSelectEventTypeEnabled = enabled,
  loadingDepartments,
  departments,
  selectedDepartment,
  setSelectedDepartment,
  setSelectedProvider,
  selectedProvider,
  showProviderPicker,
  serviceProviders,
  onClearOptionalServices,
  loadingProviderScopedCatalog = false,
  providerScopedCatalogServices = [],
  providerCatalogContextReady = false,
  providerScopedCatalogSettled = false,
  onAutoSelectSingleService,
  loadingEventTypes = false,
  eventTypes = [],
  selectedType = null,
  setSelectedType,
  eventTypeContextReady = true,
}: UseAutoSelectSoleBookingOptionsParams) {
  useLayoutEffect(() => {
    if (!autoSelectEventTypeEnabled || loadingEventTypes || !setSelectedType) return;
    if (eventTypes.length !== 1 || !eventTypeContextReady) return;
    const soleEventType = eventTypes[0];
    if (selectedType?.id === soleEventType.id) return;
    setSelectedType(soleEventType);
  }, [
    autoSelectEventTypeEnabled,
    loadingEventTypes,
    eventTypes,
    selectedType,
    setSelectedType,
    eventTypeContextReady,
  ]);

  useLayoutEffect(() => {
    if (!enabled || loadingDepartments) return;
    if (departments.length !== 1) return;
    const soleDepartment = departments[0];
    if (selectedDepartment?.id === soleDepartment.id) return;
    setSelectedDepartment(soleDepartment);
    setSelectedProvider(null);
    onClearOptionalServices?.();
  }, [
    enabled,
    loadingDepartments,
    departments,
    selectedDepartment,
    setSelectedDepartment,
    setSelectedProvider,
    onClearOptionalServices,
  ]);

  useLayoutEffect(() => {
    if (!enabled || !selectedDepartment || !showProviderPicker) return;
    if (serviceProviders.length !== 1) return;
    const soleProvider = serviceProviders[0];
    if (selectedProvider?.id === soleProvider.id) return;
    setSelectedProvider(soleProvider);
  }, [
    enabled,
    selectedDepartment,
    showProviderPicker,
    serviceProviders,
    selectedProvider,
    setSelectedProvider,
  ]);

  // Auto-selecting the sole service must not fight the user, who may deselect an
  // optional service, so it runs once per department/provider context.
  const autoSelectedServiceContextRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!enabled || !selectedDepartment) return;
    if (showProviderPicker && !selectedProvider) return;

    const gate = resolve_provider_scoped_service_gate(
      providerScopedCatalogServices,
      loadingProviderScopedCatalog,
      providerCatalogContextReady,
      providerScopedCatalogSettled
    );
    if (!gate.catalogReady || !gate.soleServiceId) return;

    const context = `${selectedDepartment.id}:${selectedProvider?.id ?? ''}`;
    if (autoSelectedServiceContextRef.current === context) return;
    autoSelectedServiceContextRef.current = context;
    onAutoSelectSingleService?.(gate.soleServiceId);
  }, [
    enabled,
    selectedDepartment,
    selectedProvider,
    showProviderPicker,
    loadingProviderScopedCatalog,
    providerScopedCatalogServices,
    providerCatalogContextReady,
    providerScopedCatalogSettled,
    onAutoSelectSingleService,
  ]);
}
