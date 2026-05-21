import { useEffect, useRef } from 'react';
import type { Department, ServiceProvider } from '@/src/types/bookingForm';

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
};

/**
 * When exactly one bookable department exists and step 1 only needs one provider
 * (or no provider picker), auto-select both and advance to the next step once.
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
}: UseAutoAdvanceStep1Params) {
  const advancedRef = useRef(false);

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
  ]);
}
