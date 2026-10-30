/** Derive initials from a display name (handles Dr. prefix and multi-word names). */
export function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0].replace(/^Dr\.?$/i, '');
  if (parts.length === 1) return (first || parts[0]).slice(0, 2).toUpperCase();
  const primary = first || parts[1] || '';
  const secondary = parts[parts.length - 1] || '';
  const a = primary.charAt(0);
  const b = secondary.charAt(0);
  return (a + b).toUpperCase() || parts[0].slice(0, 2).toUpperCase();
}

/** Single-character fallback from name or email. */
export function userInitialChar(name?: string, email?: string): string {
  const fromName = name?.trim();
  if (fromName) return fromName.charAt(0).toUpperCase();
  const fromEmail = email?.trim();
  if (fromEmail) return fromEmail.charAt(0).toUpperCase();
  return '?';
}
