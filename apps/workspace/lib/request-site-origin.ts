/**
 * Canonical browser-facing origin for redirects and absolute URLs.
 * Prefer NEXT_PUBLIC_APP_URL so it matches marketing links and cookies.
 * On Vercel behind a custom domain, x-forwarded-host matches the browser when env is unset.
 */
export function getPublicSiteOrigin(req: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) {
    const proto = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : "https";
    return `${proto}://${forwardedHost}`.replace(/\/$/, "");
  }
  const raw = req.url;
  if (typeof raw === "string" && raw.startsWith("http")) {
    return new URL(raw).origin.replace(/\/$/, "");
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }
  return "";
}

/**
 * Absolute app origin for server-only callers (cron, no Request).
 * Set NEXT_PUBLIC_APP_URL locally (e.g. http://localhost:3000) so internal fetch works.
 */
export function getServerAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }
  return "";
}
