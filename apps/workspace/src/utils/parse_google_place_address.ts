export type parsed_address = {
  formattedAddress: string;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
};

function get_component(
  components: google.maps.GeocoderAddressComponent[],
  type: string,
  useShort = false
): string {
  const match = components.find((component) => component.types.includes(type));
  if (!match) return "";
  return useShort ? match.short_name : match.long_name;
}

export function parse_google_place_address(
  place: google.maps.places.PlaceResult
): parsed_address {
  const components = place.address_components ?? [];
  const streetNumber = get_component(components, "street_number");
  const route = get_component(components, "route");
  const city =
    get_component(components, "locality") ||
    get_component(components, "administrative_area_level_2") ||
    get_component(components, "sublocality") ||
    get_component(components, "postal_town");
  const state = get_component(components, "administrative_area_level_1");
  const zipcode = get_component(components, "postal_code");
  const country = get_component(components, "country");
  const street = [streetNumber, route].filter(Boolean).join(" ");
  const formattedAddress = place.formatted_address?.trim() || street;

  return {
    formattedAddress,
    address: street || formattedAddress,
    city,
    state,
    zipcode,
    country,
  };
}

export function build_address_display_line(parts: {
  address: string;
  city: string;
  addressState: string;
  zipcode: string;
  country: string;
}): string {
  const { address, city, addressState, zipcode, country } = parts;
  if (address.includes(",") && (city || addressState || country)) {
    return address;
  }
  return [address, city, addressState, zipcode, country].filter(Boolean).join(", ");
}
