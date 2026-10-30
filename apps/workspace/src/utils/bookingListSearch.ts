import { normalizeInviteePhoneForStorage } from '@/src/utils/phone';

/** Escape SQL LIKE wildcards so user input is matched literally. */
export function escapeLikePattern(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** Wrap PostgREST filter values that would break `.or()` lists. */
function quotePostgrestFilterValue(value: string): string {
  if (/[(),]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatPostgrestIlike(column: string, term: string): string {
  const pattern = `%${escapeLikePattern(term)}%`;
  return `${column}.ilike.${quotePostgrestFilterValue(pattern)}`;
}

function uniqueClauses(clauses: string[]): string[] {
  return [...new Set(clauses)];
}

/**
 * Builds a PostgREST `.or()` expression for workspace booking list search.
 * Matches client name/email, provider name, and invitee phone (partial + E.164).
 */
export function buildBookingsSearchOrExpression(rawSearch: string): string | null {
  const trimmed = rawSearch.trim();
  if (!trimmed) return null;

  const clauses: string[] = [
    formatPostgrestIlike('invitee_name', trimmed),
    formatPostgrestIlike('invitee_email', trimmed),
    formatPostgrestIlike('service_provider_name', trimmed),
  ];

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 3) {
    clauses.push(formatPostgrestIlike('invitee_phone', digits));
  }

  const compact = trimmed.replace(/\s/g, '');
  if (compact.startsWith('+') && compact.length >= 4) {
    clauses.push(formatPostgrestIlike('invitee_phone', compact));
  }

  const normalized = normalizeInviteePhoneForStorage(trimmed);
  if (normalized.value && !normalized.invalid) {
    clauses.push(formatPostgrestIlike('invitee_phone', normalized.value));
  }

  const expression = uniqueClauses(clauses).join(',');
  return expression.length > 0 ? expression : null;
}
