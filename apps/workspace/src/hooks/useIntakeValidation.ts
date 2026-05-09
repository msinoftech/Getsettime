import { useMemo } from 'react';
import type { IntakeFormSettings } from '@/src/types/workspace';
import { getCustomFieldType, isServicesEnabled } from '@/src/utils/intakeForm';
import { isNonEmptyString, isValidDate, isValidEmail, isValidPhone, isValidUrl } from '@/src/utils/validation';
import type { meeting_option_key } from '@/src/utils/meeting_options';

export type intake_meeting_options_validation = {
  enabledKeys: meeting_option_key[];
  selectedKey: string;
};

export function useIntakeValidation(
  intakeForm: IntakeFormSettings | undefined,
  name: string,
  email: string,
  phone: string,
  customFieldValues: Record<string, string>,
  selectedServiceIds: string[],
  services: { id: string }[],
  loadingServices: boolean,
  /** When true (e.g. step-1 optional catalog is shown), do not require intake services. */
  skipIntakeServicesValidation?: boolean,
  meetingOptions?: intake_meeting_options_validation | null
): Record<string, string> {
  return useMemo(() => {
    const errors: Record<string, string> = {};
    const nameEnabled = intakeForm?.name !== false;
    const emailEnabled = intakeForm?.email !== false;
    const phoneEnabled = intakeForm?.phone === true;
    const servicesEnabled = isServicesEnabled(intakeForm);

    if (nameEnabled && !isNonEmptyString(name)) errors.name = 'Name is required';
    if (emailEnabled) {
      if (!isNonEmptyString(email)) errors.email = 'Email is required';
      else if (!isValidEmail(email)) errors.email = 'Enter a valid email';
    }
    if (phoneEnabled) {
      if (!isNonEmptyString(phone)) errors.phone = 'Phone is required';
      else if (!isValidPhone(phone)) errors.phone = 'Enter a valid phone number';
    }
    if (servicesEnabled && !skipIntakeServicesValidation) {
      if (loadingServices) errors.services = 'Loading services…';
      else if (services.length === 0) errors.services = 'No services available';
      else if (selectedServiceIds.length === 0) errors.services = 'Please select at least one service';
    }

    if (meetingOptions && meetingOptions.enabledKeys.length > 1) {
      const sel = meetingOptions.selectedKey.trim();
      if (!isNonEmptyString(sel)) {
        errors.meeting_option = 'Please select how you would like to meet';
      } else if (!meetingOptions.enabledKeys.includes(sel as meeting_option_key)) {
        errors.meeting_option = 'Please select a valid meeting option';
      }
    }

    const customFields = intakeForm?.custom_fields || [];
    for (const field of customFields) {
      const id = field.id;
      const label = field.label || id;
      const required = field.required === true;
      const value = (customFieldValues[id] || '').trim();
      const type = getCustomFieldType(field);
      const options =
        type === 'select' && Array.isArray(field.options)
          ? field.options.map((opt) => (typeof opt === 'string' ? opt : opt.value))
          : [];
      if (required && !value) {
        errors[id] = `${label} is required`;
        continue;
      }
      if (!value) continue;
      if (type === 'number') {
        const n = Number(value);
        if (Number.isNaN(n)) errors[id] = `${label} must be a number`;
      } else if (type === 'email') {
        if (!isValidEmail(value)) errors[id] = `${label} must be a valid email`;
      } else if (type === 'tel') {
        if (!isValidPhone(value)) errors[id] = `${label} must be a valid phone number`;
      } else if (type === 'url') {
        if (!isValidUrl(value)) errors[id] = `${label} must be a valid URL (include http:// or https://)`;
      } else if (type === 'date') {
        if (!isValidDate(value)) errors[id] = `${label} must be a valid date`;
      } else if (type === 'select') {
        if (options.length > 0 && !options.includes(value)) {
          errors[id] = `${label} has an invalid selection`;
        }
      }
    }

    if (
      intakeForm?.name === false &&
      intakeForm?.email === false &&
      intakeForm?.phone === false
    ) {
      errors._config = 'Invalid intake form configuration (no identifier fields enabled)';
    }
    return errors;
  }, [
    customFieldValues,
    email,
    intakeForm,
    loadingServices,
    meetingOptions,
    name,
    phone,
    selectedServiceIds.length,
    services.length,
    skipIntakeServicesValidation,
  ]);
}
