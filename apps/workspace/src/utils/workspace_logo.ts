/** Public path fallback when workspace has no `logo_url` (see `public/getsettime-logo.svg`). */
const FALLBACK_PUBLIC_PATH = '/getsettime-logo.svg';

const env_fallback =
  typeof process.env.NEXT_PUBLIC_WORKSPACE_LOGO_FALLBACK_SRC === 'string'
    ? process.env.NEXT_PUBLIC_WORKSPACE_LOGO_FALLBACK_SRC.trim()
    : '';

export const WORKSPACE_LOGO_FALLBACK_SRC =
  env_fallback !== '' ? env_fallback : FALLBACK_PUBLIC_PATH;

/** Final `src` for workspace branding: uploaded URL or app fallback. */
export function resolve_workspace_logo_src(
  logo_url: string | null | undefined
): string {
  if (typeof logo_url === 'string' && logo_url.trim() !== '') {
    return logo_url.trim();
  }
  return WORKSPACE_LOGO_FALLBACK_SRC;
}

export function workspace_logo_is_remote(src: string): boolean {
  return (
    typeof src === 'string' &&
    (src.startsWith('http://') || src.startsWith('https://'))
  );
}
