export type workspace_contact_settings = {
  business_email?: string | null;
  business_phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  country?: string | null;
};

function pick_string(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function format_workspace_address(
  general: workspace_contact_settings
): string | null {
  const parts: string[] = [];
  const street = pick_string(general.address);
  if (street) parts.push(street);

  const city = pick_string(general.city);
  const state = pick_string(general.state);
  const zipcode = pick_string(general.zipcode);
  const city_state_zip = [
    city,
    [state, zipcode].filter(Boolean).join(' ') || null,
  ]
    .filter(Boolean)
    .join(', ');
  if (city_state_zip) parts.push(city_state_zip);

  const country = pick_string(general.country);
  if (country) parts.push(country);

  return parts.length > 0 ? parts.join(', ') : null;
}

export function resolve_workspace_contact_from_general(
  general: Record<string, unknown> | null | undefined
): workspace_contact_settings & { formatted_address: string | null } {
  const contact: workspace_contact_settings = {
    business_email: pick_string(general?.business_email),
    business_phone: pick_string(general?.business_phone),
    address: pick_string(general?.address),
    city: pick_string(general?.city),
    state: pick_string(general?.state),
    zipcode: pick_string(general?.zipcode),
    country: pick_string(general?.country),
  };

  return {
    ...contact,
    formatted_address: format_workspace_address(contact),
  };
}
