import type {
  IntakeCustomField,
  IntakeCustomFieldType,
  IntakeFormSettings,
  IntakeFormServiceSettings,
} from '@/src/types/workspace';

export const getCustomFieldType = (field: IntakeCustomField): IntakeCustomFieldType =>
  (field.type || field.field_type || 'text') as IntakeCustomFieldType;

export const isServicesEnabled = (settings: IntakeFormSettings | undefined): boolean => {
  const services = settings?.services;
  if (typeof services === 'boolean') return services;
  return Boolean(services?.enabled);
};

export const getAllowedServiceIds = (settings: IntakeFormSettings | undefined): string[] => {
  const services = settings?.services;
  if (typeof services === 'boolean') return [];
  return services?.allowed_service_ids || [];
};

/** Normalized shape for form usage (services always object) */
export interface NormalizedIntakeForm {
  name: boolean;
  email: boolean;
  phone: boolean;
  services: { enabled: boolean; allowed_service_ids: string[] };
  additional_description: boolean;
  custom_fields: Array<{
    id: string;
    label: string;
    field_type: string;
    required?: boolean;
    placeholder?: string;
  }>;
}

export function normalizeIntakeForm(
  settings: IntakeFormSettings | undefined | null
): NormalizedIntakeForm | null {
  if (!settings) return null;

  const rawServices = settings.services;
  const rawObj =
    typeof rawServices === 'boolean'
      ? { enabled: rawServices, allowed_service_ids: [] }
      : (rawServices as IntakeFormServiceSettings | undefined);
  const services = {
    enabled: rawObj?.enabled ?? false,
    allowed_service_ids: rawObj?.allowed_service_ids ?? [],
  };

  const customFields = (settings.custom_fields ?? []).map((f) => ({
    ...f,
    field_type: (f.field_type ?? f.type ?? "text") as string,
    required: f.required ?? false,
    placeholder: f.placeholder,
  }));

  return {
    name: settings.name ?? true,
    email: settings.email ?? true,
    phone: settings.phone ?? false,
    services: {
      enabled: services.enabled ?? false,
      allowed_service_ids: services.allowed_service_ids ?? [],
    },
    additional_description: settings.additional_description ?? false,
    custom_fields: customFields,
  };
}
