import { useEffect, useRef } from 'react';
import type { Department, Service, ServiceProvider } from '@/src/types/bookingForm';
import { resolve_provider_scoped_service_gate } from '@/src/utils/provider_scoped_service_gate';

type UseAutoAdvanceStep1Params = {
  enabled: boolean;
  step: number;
  loadingDepartments: boolean;
  departments: Department[];
  selectedDepartment: Department | null;
  setSelectedDepartment: (dept: Department | null) => void;
  setSelectedProvider: (provider: ServiceProvider | null) => void;
  selectedProvider: ServiceProvider | null;
  showProviderPicker: boolean;
  serviceProviders: ServiceProvider[];
  onClearOptionalServices?: () => void;
  advanceToNextStep: () => void;
  loadingProviderScopedCatalog?: boolean;
  providerScopedCatalogServices?: Service[];
  providerCatalogContextReady?: boolean;
  providerScopedCatalogSettled?: boolean;
  onAutoSelectSingleService?: (id: string) => void;
};

/**
 * When exactly one bookable department exists and step 1 only needs one provider
 * (or no provider picker), auto-select both and advance to the next step once.
 * Waits for provider-scoped catalog load; blocks auto-advance when multiple services exist.
 */
export function useAutoAdvanceStep1({
  enabled,
  step,
  loadingDepartments,
  departments,
  selectedDepartment,
  setSelectedDepartment,
  setSelectedProvider,
  selectedProvider,
  showProviderPicker,
  serviceProviders,
  onClearOptionalServices,
  advanceToNextStep,
  loadingProviderScopedCatalog = false,
  providerScopedCatalogServices = [],
  providerCatalogContextReady = false,
  providerScopedCatalogSettled = false,
  onAutoSelectSingleService,
}: UseAutoAdvanceStep1Params) {
  const advancedRef = useRef(false);
  const lastDeptIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (departments.length !== 1 || selectedDepartment?.id !== departments[0]?.id) {
      advancedRef.current = false;
    }
    if (selectedDepartment?.id !== lastDeptIdRef.current) {
      advancedRef.current = false;
      lastDeptIdRef.current = selectedDepartment?.id ?? null;
    }
  }, [departments, selectedDepartment?.id]);

  useEffect(() => {
    if (!enabled || loadingDepartments || step !== 1 || advancedRef.current) return;
    if (departments.length !== 1) return;

    const soleDept = departments[0];

    if (!selectedDepartment || selectedDepartment.id !== soleDept.id) {
      setSelectedDepartment(soleDept);
      setSelectedProvider(null);
      onClearOptionalServices?.();
      return;
    }

    if (showProviderPicker) {
      if (serviceProviders.length !== 1) return;
      const soleProvider = serviceProviders[0];
      if (!selectedProvider || selectedProvider.id !== soleProvider.id) {
        setSelectedProvider(soleProvider);
        return;
      }
    }

    const ready =
      !!selectedDepartment &&
      (!showProviderPicker ||
        (serviceProviders.length === 1 && selectedProvider?.id === serviceProviders[0].id));

    if (!ready) return;

    const serviceGate = resolve_provider_scoped_service_gate(
      providerScopedCatalogServices,
      loadingProviderScopedCatalog,
      providerCatalogContextReady,
      providerScopedCatalogSettled
    );

    if (providerCatalogContextReady && !serviceGate.catalogReady) return;
    if (!serviceGate.canAutoAdvancePastStep1) return;

    if (serviceGate.soleServiceId) {
      onAutoSelectSingleService?.(serviceGate.soleServiceId);
    }

    advancedRef.current = true;
    advanceToNextStep();
  }, [
    enabled,
    step,
    loadingDepartments,
    departments,
    selectedDepartment,
    selectedProvider,
    showProviderPicker,
    serviceProviders,
    setSelectedDepartment,
    setSelectedProvider,
    onClearOptionalServices,
    advanceToNextStep,
    loadingProviderScopedCatalog,
    providerScopedCatalogServices,
    providerCatalogContextReady,
    providerScopedCatalogSettled,
    onAutoSelectSingleService,
  ]);
}
