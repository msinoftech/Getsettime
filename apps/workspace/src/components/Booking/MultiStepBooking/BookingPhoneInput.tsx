'use client';

import type { CSSProperties } from 'react';
import { PhoneInput, type CountryIso2 } from 'react-international-phone';
import 'react-international-phone/style.css';
import { useDefaultPhoneCountry } from '@/src/hooks/useDefaultPhoneCountry';
import { DEFAULT_COUNTRY } from '@app/location';
import { saveCountry } from '@/src/services/countryDetection';
import { BOOKING_PLACEHOLDERS } from '@/src/constants/booking';

interface BookingPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  required?: boolean;
  profileCountry?: string | null;
  inputClassName?: string;
}

export function BookingPhoneInput({
  value,
  onChange,
  onBlur,
  required,
  profileCountry,
  inputClassName = '',
}: BookingPhoneInputProps) {
  const { country, loadingCountry } = useDefaultPhoneCountry(profileCountry);
  const countryIso2 =
    typeof country === 'string' && country.trim().length === 2
      ? country.trim().toUpperCase()
      : DEFAULT_COUNTRY;
  const defaultCountryLower = countryIso2.toLowerCase() as CountryIso2;

  if (loadingCountry) {
    return (
      <div
        className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-4 text-sm text-gray-500"
        aria-hidden
      >
        Detecting your country…
      </div>
    );
  }

  return (
    <div className="booking-phone-input group w-full rounded-xl border-2 border-gray-200 bg-white transition-all focus-within:border-indigo-500 hover:border-gray-300">
      <PhoneInput
        key={defaultCountryLower}
        defaultCountry={defaultCountryLower}
        value={value}
        onChange={(phone: string, meta: { country: { iso2: CountryIso2 } }) => {
          onChange(phone);
          if (meta.country?.iso2) saveCountry(meta.country.iso2);
        }}
        onBlur={onBlur}
        placeholder={BOOKING_PLACEHOLDERS.phone}
        required={required}
        forceDialCode
        disableDialCodeAndPrefix
        showDisabledDialCodeAndPrefix
        className="booking-phone-input__root"
        style={
          {
            '--react-international-phone-border-color': 'transparent',
            '--react-international-phone-dial-code-preview-border-color': 'transparent',
            '--react-international-phone-country-selector-border-color': 'transparent',
            width: '100%',
          } as CSSProperties
        }
        inputClassName={`booking-phone-input__field ${inputClassName}`}
        countrySelectorStyleProps={{
          buttonClassName: 'booking-phone-input__country-btn',
          dropdownStyleProps: {
            className:
              '!mt-2 !rounded-xl !border !border-gray-100 !bg-white !p-2 !shadow-xl',
          },
        }}
        dialCodePreviewStyleProps={{
          className: 'booking-phone-input__dial-code',
        }}
      />
    </div>
  );
}
