'use client';

import { PhoneInput, type CountryIso2 } from 'react-international-phone';
import 'react-international-phone/style.css';
import { useDefaultPhoneCountry } from '@/src/hooks/useDefaultPhoneCountry';
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
  const defaultCountryLower = country.toLowerCase() as CountryIso2;

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
    <div className="booking-phone-input group relative rounded-xl border-2 border-gray-200 bg-white transition-all focus-within:border-indigo-500 hover:border-gray-300">
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
        className="w-full"
        inputClassName={`!h-auto !min-h-[52px] !w-full !border-0 !bg-transparent !pl-[118px] !pr-4 !py-4 !text-base !outline-none focus:!ring-0 ${inputClassName}`}
        countrySelectorStyleProps={{
          buttonClassName:
            '!absolute !left-3 !top-1/2 !z-10 !h-10 !-translate-y-1/2 !rounded-lg !border !border-gray-200 !bg-gray-50 !px-2 hover:!bg-indigo-50',
          dropdownStyleProps: {
            className:
              '!mt-2 !rounded-xl !border !border-gray-100 !bg-white !p-2 !shadow-xl',
          },
        }}
      />
    </div>
  );
}
