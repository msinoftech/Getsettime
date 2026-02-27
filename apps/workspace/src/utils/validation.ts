/** Shared validation utilities for forms */

export const isNonEmptyString = (v: string): boolean => v.trim().length > 0;

export const isValidEmail = (email: string): boolean => {
  const v = email.trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
};

export const normalizePhone = (phone: string): string => phone.replace(/[^\d]/g, '');

export const isValidPhone = (phone: string): boolean => {
  const digits = normalizePhone(phone);
  return digits.length >= 7;
};

export const isValidUrl = (url: string): boolean => {
  const v = url.trim();
  if (!v) return false;
  if (!/^https?:\/\//i.test(v)) return false;
  try {
    const parsed = new URL(v);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname;
    const lastDot = host.lastIndexOf('.');
    if (lastDot === -1 || lastDot === host.length - 1) return false;
    const tld = host.slice(lastDot + 1);
    return tld.length >= 1 && /^[a-zA-Z0-9-]+$/.test(tld);
  } catch {
    return false;
  }
};

export const isValidDate = (value: string): boolean => {
  const v = value.trim();
  if (!v) return false;
  return !Number.isNaN(Date.parse(v));
};
