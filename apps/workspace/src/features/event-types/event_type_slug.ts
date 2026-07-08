export function slugify_event_type_title(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalize_event_type_slug_input(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function validate_event_type_slug_input(
  slug: string
): { ok: true; value: string } | { ok: false; message: string } {
  const normalized = normalize_event_type_slug_input(slug);
  if (!normalized) {
    return { ok: false, message: "Event URL slug is required." };
  }
  return { ok: true, value: normalized };
}

export function parse_short_description_from_settings(
  settings: unknown
): string {
  if (!settings || typeof settings !== "object") return "";
  const value = (settings as Record<string, unknown>).short_description;
  return typeof value === "string" ? value : "";
}

export function build_event_type_settings(
  short_description: string
): Record<string, unknown> | null {
  const trimmed = short_description.trim();
  return trimmed ? { short_description: trimmed } : null;
}

export async function check_event_type_slug_available(
  accessToken: string,
  slug: string,
  excludeEventTypeId?: number | null
): Promise<{ available: boolean; message: string | null }> {
  const normalized = normalize_event_type_slug_input(slug);
  if (!normalized) {
    return { available: false, message: "Event URL slug is required." };
  }

  const params = new URLSearchParams({ slug: normalized });
  if (excludeEventTypeId != null && excludeEventTypeId > 0) {
    params.set("exclude_id", String(excludeEventTypeId));
  }

  const response = await fetch(`/api/event-types/check-slug?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return {
      available: false,
      message:
        typeof body?.error === "string"
          ? body.error
          : "Could not verify URL slug.",
    };
  }

  const body = await response.json();
  if (body.available === false) {
    return {
      available: false,
      message:
        typeof body.message === "string"
          ? body.message
          : "This URL slug is already used by another event type in your workspace.",
    };
  }

  return { available: true, message: null };
}
