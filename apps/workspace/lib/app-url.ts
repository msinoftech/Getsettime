import type { NextRequest } from 'next/server';

const DEFAULT_APP_URL = 'http://localhost:3000';

/**
 * Resolves the application base URL (no trailing slash).
 * Priority: NEXT_PUBLIC_APP_URL env → request origin → localhost fallback.
 * Use in API routes; pass `req` when available for proxy/container setups.
 */
export function getAppBaseUrl(request?: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  if (request) {
    const url = typeof request.url === 'string' && request.url.startsWith('http')
      ? request.url
      : request.nextUrl?.origin;
    if (url) return new URL(url).origin;
  }

  return DEFAULT_APP_URL;
}

/**
 * Builds a full URL for the given path.
 * Ensures a single slash between base and path.
 */
export function appUrl(path: string, request?: NextRequest): string {
  const base = getAppBaseUrl(request);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
