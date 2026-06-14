import type { Service } from '@/src/types/bookingForm';

export type provider_scoped_service_gate = {
  catalogReady: boolean;
  requiresManualSelection: boolean;
  canAutoAdvancePastStep1: boolean;
  soleServiceId: string | null;
};

export function resolve_provider_scoped_service_gate(
  services: Service[],
  loading: boolean,
  contextReady: boolean,
  catalogSettled = false
): provider_scoped_service_gate {
  const catalogReady = contextReady && catalogSettled && !loading;
  const count = services.length;

  return {
    catalogReady,
    requiresManualSelection: contextReady && catalogReady && count > 1,
    canAutoAdvancePastStep1:
      !contextReady || (catalogReady && count <= 1),
    soleServiceId: count === 1 ? services[0].id : null,
  };
}
