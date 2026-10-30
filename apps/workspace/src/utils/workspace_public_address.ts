import { build_address_display_line } from '@/src/utils/parse_google_place_address';

export type WorkspacePublicAddress = {
  line1: string;
  line2: string | null;
};

export function format_workspace_public_address(
  general: Record<string, unknown> | null | undefined
): WorkspacePublicAddress | null {
  if (!general) return null;

  const address = typeof general.address === 'string' ? general.address.trim() : '';
  const city = typeof general.city === 'string' ? general.city.trim() : '';
  const state =
    typeof general.state === 'string'
      ? general.state.trim()
      : typeof general.addressState === 'string'
        ? general.addressState.trim()
        : '';
  const zipcode = typeof general.zipcode === 'string' ? general.zipcode.trim() : '';
  const country = typeof general.country === 'string' ? general.country.trim() : '';

  const fullLine = build_address_display_line({
    address,
    city,
    addressState: state,
    zipcode,
    country,
  }).trim();

  if (!fullLine) return null;

  const line1 =
    [city, state].filter(Boolean).join(', ') ||
    address ||
    fullLine;
  const line2Parts = [zipcode, country].filter(Boolean);
  let line2 = line2Parts.length > 0 ? line2Parts.join(', ') : null;

  if (!city && !state && address && address !== line1) {
    line2 = [address, line2].filter(Boolean).join(' · ') || null;
  } else if (address && address !== line1 && !line2?.includes(address)) {
    line2 = line2 ? `${address} · ${line2}` : address;
  }

  if (line2 === line1) line2 = null;

  return { line1, line2 };
}
