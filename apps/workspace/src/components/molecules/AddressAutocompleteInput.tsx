'use client';

import { useEffect, useRef } from 'react';
import { useGoogleMapsScript } from '@/src/hooks/useGoogleMapsScript';
import {
  parse_google_place_address,
  type parsed_address,
} from '@/src/utils/parse_google_place_address';

type AddressAutocompleteInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (parsed: parsed_address) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export function AddressAutocompleteInput({
  id,
  value,
  onChange,
  onPlaceSelect,
  disabled = false,
  placeholder = 'Start typing your address…',
  className = '',
}: AddressAutocompleteInputProps) {
  const input_ref = useRef<HTMLInputElement>(null);
  const autocomplete_ref = useRef<google.maps.places.Autocomplete | null>(null);
  const on_change_ref = useRef(onChange);
  const on_place_select_ref = useRef(onPlaceSelect);
  const { ready, error } = useGoogleMapsScript();

  useEffect(() => {
    on_change_ref.current = onChange;
  }, [onChange]);

  useEffect(() => {
    on_place_select_ref.current = onPlaceSelect;
  }, [onPlaceSelect]);

  useEffect(() => {
    if (!ready || disabled || !input_ref.current || autocomplete_ref.current) {
      return;
    }

    const autocomplete = new google.maps.places.Autocomplete(input_ref.current, {
      types: ['address'],
      fields: ['address_components', 'formatted_address', 'geometry'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place) return;
      const parsed = parse_google_place_address(place);
      on_change_ref.current(parsed.formattedAddress);
      on_place_select_ref.current(parsed);
    });

    autocomplete_ref.current = autocomplete;

    return () => {
      google.maps.event.clearInstanceListeners(autocomplete);
      autocomplete_ref.current = null;
    };
  }, [ready, disabled]);

  return (
    <div>
      <input
        ref={input_ref}
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        autoComplete="off"
        placeholder={placeholder}
        className={className}
      />
      {error ? (
        <p className="mt-2 text-xs text-amber-700">
          Address suggestions are unavailable. You can still type your address manually.
        </p>
      ) : null}
    </div>
  );
}
