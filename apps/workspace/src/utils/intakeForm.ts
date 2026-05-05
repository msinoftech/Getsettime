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
  file_upload: boolean;
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

  const customFields = (settings.custom_fields ?? []).map((f) => {
    const fr = f as Record<string, unknown>;
    const labelFrom =
      (typeof f.label === 'string' && f.label) ||
      (typeof fr.field_label === 'string' && fr.field_label) ||
      (typeof fr.title === 'string' && fr.title) ||
      '';
    return {
      ...f,
      id: String(f.id),
      label: typeof labelFrom === 'string' ? labelFrom.trim() : '',
      field_type: (f.field_type ?? f.type ?? "text") as string,
      required: f.required ?? false,
      placeholder: f.placeholder,
    };
  });

  return {
    name: settings.name ?? true,
    email: settings.email ?? true,
    phone: settings.phone ?? false,
    file_upload: settings.file_upload ?? false,
    services: {
      enabled: services.enabled ?? false,
      allowed_service_ids: services.allowed_service_ids ?? [],
    },
    additional_description: settings.additional_description ?? false,
    custom_fields: customFields,
  };
}

/** Keys stored in `metadata.intake_form` that are not workspace-defined custom fields. */
const INTAKE_FORM_PAYLOAD_RESERVED_KEYS = new Set([
  'name',
  'email',
  'phone',
  'services',
  'additional_description',
  'file_upload_url',
  'whatsapp_opt_in',
]);

export function isIntakeFormReservedPayloadKey(key: string): boolean {
  return INTAKE_FORM_PAYLOAD_RESERVED_KEYS.has(key);
}

/** Whether an intake/custom field value should appear in summaries (allows 0, non-empty arrays). */
export function intakeCustomFieldHasDisplayValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return !Number.isNaN(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function formatIntakeFieldValueForDisplay(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map((x) => String(x)).join(', ');
  return String(value);
}

type IntakeFieldSchemaRow = { id: string; label: string };

function payloadValueForFieldId(
  data: Record<string, unknown>,
  fieldId: string
): unknown {
  if (Object.prototype.hasOwnProperty.call(data, fieldId)) return data[fieldId];
  const asStringKey = String(fieldId);
  if (asStringKey !== fieldId && Object.prototype.hasOwnProperty.call(data, asStringKey)) {
    return data[asStringKey];
  }
  return undefined;
}

/** Value for a custom field id in `metadata.intake_form` (handles key coercion). */
export function getIntakePayloadValue(
  intakePayload: Record<string, unknown> | undefined | null,
  fieldId: string
): unknown {
  return payloadValueForFieldId(intakePayload ?? {}, fieldId);
}

/**
 * Parse `custom_fields` from raw workspace JSON (API / DB may use loose shapes).
 */
export function parseIntakeCustomFieldsSchema(
  intakeRaw: unknown
): Array<{ id: string; label: string }> {
  if (!intakeRaw || typeof intakeRaw !== 'object') return [];
  const cf = (intakeRaw as Record<string, unknown>).custom_fields;
  if (!Array.isArray(cf)) return [];
  const out: Array<{ id: string; label: string }> = [];
  for (const item of cf) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = o.id != null ? String(o.id) : '';
    if (!id) continue;
    const labelRaw =
      (typeof o.label === 'string' && o.label) ||
      (typeof o.field_label === 'string' && o.field_label) ||
      (typeof o.title === 'string' && o.title) ||
      '';
    out.push({ id, label: labelRaw.trim() });
  }
  return out;
}

function buildOrphanIntakeFieldsForDisplay(
  intakePayload: Record<string, unknown>,
  schemaIds: Set<string>
): Array<{ id: string; label: string; value: string }> {
  const rows: Array<{ id: string; label: string; value: string }> = [];
  for (const key of Object.keys(intakePayload)) {
    if (isIntakeFormReservedPayloadKey(key) || schemaIds.has(String(key))) continue;
    const v = intakePayload[key];
    if (!intakeCustomFieldHasDisplayValue(v)) continue;
    rows.push({
      id: key,
      label: displayLabelForIntakeField(key, null),
      value: formatIntakeFieldValueForDisplay(v),
    });
  }
  return rows;
}

/** Label for intake custom field in summaries (falls back if admin left label empty). */
export function displayLabelForIntakeField(
  fieldId: string,
  configuredLabel: string | undefined | null
): string {
  const t = typeof configuredLabel === 'string' ? configuredLabel.trim() : '';
  if (t) return t;
  if (/^\d+$/.test(String(fieldId))) return 'Custom field';
  return String(fieldId)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolved custom-field rows for previews (schema order first, then unknown keys in payload).
 */
export function buildIntakeCustomFieldsForDisplay(
  intakePayload: Record<string, unknown> | undefined | null,
  schemaFields: IntakeFieldSchemaRow[]
): Array<{ id: string; label: string; value: string }> {
  const data = intakePayload ?? {};
  const rows: Array<{ id: string; label: string; value: string }> = [];
  const seen = new Set<string>();

  for (const field of schemaFields) {
    const v = payloadValueForFieldId(data, field.id);
    if (!intakeCustomFieldHasDisplayValue(v)) continue;
    rows.push({
      id: String(field.id),
      label: displayLabelForIntakeField(field.id, field.label),
      value: formatIntakeFieldValueForDisplay(v),
    });
    seen.add(String(field.id));
  }

  const schemaIds = new Set(schemaFields.map((f) => String(f.id)));
  for (const key of Object.keys(data)) {
    if (isIntakeFormReservedPayloadKey(key) || seen.has(key)) continue;
    if (schemaIds.has(String(key))) continue;
    const v = data[key];
    if (!intakeCustomFieldHasDisplayValue(v)) continue;
    rows.push({
      id: key,
      label: displayLabelForIntakeField(key, null),
      value: formatIntakeFieldValueForDisplay(v),
    });
    seen.add(key);
  }
  return rows;
}

/**
 * Rows for booking previews: schema fields (with labels from raw workspace JSON when needed)
 * then payload-only keys not in the schema.
 */
export function buildIntakeCustomFieldsForPreviewDisplay(
  intakePayload: Record<string, unknown> | undefined | null,
  intakeFormRaw: unknown,
  normalizedFields: IntakeFieldSchemaRow[] | undefined | null
): Array<{ id: string; label: string; value: string }> {
  const parsed = parseIntakeCustomFieldsSchema(intakeFormRaw);
  const byParsedLabel = new Map(parsed.map((p) => [p.id, p.label]));

  const baseSchema: IntakeFieldSchemaRow[] =
    normalizedFields && normalizedFields.length > 0 ? normalizedFields : parsed;

  const schema: IntakeFieldSchemaRow[] = baseSchema.map((f) => {
    const id = String(f.id);
    const parsedLabel = (byParsedLabel.get(id) ?? '').trim();
    const normLabel = typeof f.label === 'string' ? f.label.trim() : '';
    const label = normLabel || parsedLabel;
    return { id, label };
  });

  const schemaIds = new Set(schema.map((f) => String(f.id)));
  const data = intakePayload ?? {};

  const fromSchema = schema
    .filter((field) => intakeCustomFieldHasDisplayValue(getIntakePayloadValue(data, field.id)))
    .map((field) => ({
      id: String(field.id),
      label: displayLabelForIntakeField(field.id, field.label),
      value: formatIntakeFieldValueForDisplay(getIntakePayloadValue(data, field.id)),
    }));

  const orphans = buildOrphanIntakeFieldsForDisplay(data, schemaIds);
  return [...fromSchema, ...orphans];
}
