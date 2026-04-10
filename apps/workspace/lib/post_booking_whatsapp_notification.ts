/**
 * Typed payload for programmatic POST /api/whatsapp (booking templates or reminder).
 */
export type post_booking_whatsapp_notification_payload = {
  name: string;
  email: string | null;
  phone: string;
  message: string;
  service?: string;
  department?: string;
  provider?: string;
  start?: string;
  end?: string;
  note?: string;
  arrive_early_min?: number;
  arrive_early_max?: number;
  booking_reference?: string;
  send_to_user: boolean;
  send_to_admin: boolean;
  admin_phone?: string[];
  skip_contact_form_email: true;
  notification_kind?: "booking" | "reminder";
};

export type post_booking_whatsapp_notification_result = {
  ok: boolean;
  error?: string;
};

export async function post_booking_whatsapp_notification(
  origin: string,
  payload: post_booking_whatsapp_notification_payload
): Promise<post_booking_whatsapp_notification_result> {
  const base = origin.replace(/\/$/, "");
  const body: Record<string, unknown> = {
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    message: payload.message,
    send_to_user: payload.send_to_user,
    send_to_admin: payload.send_to_admin,
    skip_contact_form_email: true,
  };
  if (payload.service !== undefined) body.service = payload.service;
  if (payload.department !== undefined) body.department = payload.department;
  if (payload.provider !== undefined) body.provider = payload.provider;
  if (payload.start !== undefined) body.start = payload.start;
  if (payload.end !== undefined) body.end = payload.end;
  if (payload.note !== undefined) body.note = payload.note;
  if (payload.arrive_early_min !== undefined) {
    body.arrive_early_min = payload.arrive_early_min;
  }
  if (payload.arrive_early_max !== undefined) {
    body.arrive_early_max = payload.arrive_early_max;
  }
  if (payload.booking_reference !== undefined) {
    body.booking_reference = payload.booking_reference;
  }
  if (payload.admin_phone !== undefined && payload.admin_phone.length > 0) {
    body.admin_phone = payload.admin_phone;
  }
  if (payload.notification_kind !== undefined) {
    body.notification_kind = payload.notification_kind;
  }

  try {
    const res = await fetch(`${base}/api/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
    };
    if (!res.ok || !json.success) {
      return {
        ok: false,
        error: json.error || `HTTP ${res.status}`,
      };
    }
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("post_booking_whatsapp_notification fetch error:", err);
    return { ok: false, error: msg };
  }
}
