export const CURRENCY_OPTIONS = ["INR", "USD", "EUR", "GBP", "CAD"] as const;

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number];

export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "$",
};

export function currencySymbol(code: string | null | undefined): string {
  if (!code) return "$";
  return CURRENCY_SYMBOLS[code] ?? "$";
}
