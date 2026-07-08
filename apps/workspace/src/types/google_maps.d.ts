declare namespace google.maps.places {
  interface AutocompleteOptions {
    types?: string[];
    fields?: string[];
  }

  interface PlaceResult {
    address_components?: google.maps.GeocoderAddressComponent[];
    formatted_address?: string;
    geometry?: unknown;
  }

  class Autocomplete {
    constructor(input: HTMLInputElement, opts?: AutocompleteOptions);
    addListener(event: string, handler: () => void): void;
    getPlace(): PlaceResult;
  }
}

declare namespace google.maps {
  interface GeocoderAddressComponent {
    long_name: string;
    short_name: string;
    types: string[];
  }

  namespace event {
    function clearInstanceListeners(instance: unknown): void;
  }
}

interface Window {
  google?: {
    maps?: {
      places?: typeof google.maps.places;
      event?: typeof google.maps.event;
    };
  };
}
