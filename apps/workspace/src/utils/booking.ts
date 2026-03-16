import type { Booking } from '@/src/types/booking';
import type { ServiceProvider, Department } from '@/src/types/booking-entities';

export function getServiceProviderName(
  serviceProviderId: string | null,
  providers: ServiceProvider[]
): string {
  if (!serviceProviderId) return 'N/A';
  const provider = providers.find((sp) => sp.id === serviceProviderId);
  return (
    provider?.raw_user_meta_data?.full_name ||
    provider?.raw_user_meta_data?.name ||
    provider?.email ||
    'N/A'
  );
}

export function getDepartmentName(
  departmentId: string | null,
  departments: Department[]
): string {
  if (!departmentId) return 'N/A';
  const dept = departments.find(
    (d) => String(d.id) === String(departmentId)
  );
  return dept?.name || 'N/A';
}

export function getDisplayName(b: Booking): string {
  return b.invitee_name?.trim() || b.contacts?.name?.trim() || 'N/A';
}

export function getDisplayEmail(b: Booking): string {
  return b.invitee_email?.trim() || b.contacts?.email?.trim() || 'N/A';
}

export function getDisplayPhone(b: Booking): string {
  return b.invitee_phone?.trim() || b.contacts?.phone?.trim() || 'N/A';
}
