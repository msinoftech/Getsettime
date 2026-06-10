/**
 * Thin wrapper — delegates to @app/location for booking/customer country detection.
 */
export {
  DEFAULT_COUNTRY,
  detectCountry,
  detectCountrySync,
  getCachedCountry,
  saveCountry,
  getCountryFromBrowserLocale,
  isValidIso2,
} from '@app/location';
