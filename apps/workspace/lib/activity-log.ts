import { createSupabaseServerClient } from "@app/db";

type ActivityEntityType =
  | "booking"
  | "contact"
  | "event_type"
  | "department"
  | "service"
  | "availability"
  | "settings";

type ActivityAction = "created" | "updated" | "deleted";

type ActivityDiffRecord = Record<string, unknown>;

export interface ActivityLogEntry {
  type: ActivityEntityType;
  entity_id?: string | number | null;
  action: "created" | "updated" | "deleted";
  title: string;
  description: string;
  actor_user_id?: string | null;
  before_data?: ActivityDiffRecord | null;
  after_data?: ActivityDiffRecord | null;
  changed_fields?: string[];
  target_path?: string | null;
  metadata?: Record<string, unknown> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeScalar(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  if (Array.isArray(value)) return value;
  if (isRecord(value)) return value;
  return value;
}

function build_changed_fields(
  before_data?: ActivityDiffRecord | null,
  after_data?: ActivityDiffRecord | null,
  provided?: string[]
): string[] {
  if (Array.isArray(provided) && provided.length > 0) {
    return Array.from(new Set(provided.filter((field) => typeof field === "string" && field.trim())));
  }
  const before = isRecord(before_data) ? before_data : {};
  const after = isRecord(after_data) ? after_data : {};
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const key of keys) {
    const beforeValue = normalizeScalar(before[key]);
    const afterValue = normalizeScalar(after[key]);
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changed.push(key);
    }
  }
  return changed;
}

function pick_diff_payload(source: ActivityDiffRecord | null | undefined, keys: string[]): ActivityDiffRecord | null {
  if (!isRecord(source) || keys.length === 0) return null;
  const picked: ActivityDiffRecord = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      picked[key] = normalizeScalar(source[key]);
    }
  }
  return Object.keys(picked).length > 0 ? picked : null;
}

function default_target_path(type: ActivityEntityType, entity_id?: string | number | null): string {
  if (type === "booking" && entity_id != null && String(entity_id).trim()) {
    return `/bookings/${String(entity_id).trim()}`;
  }
  if (type === "event_type" && entity_id != null && String(entity_id).trim()) {
    return `/event-type/${String(entity_id).trim()}/edit`;
  }
  if (type === "event_type") return "/event-type";
  if (type === "department") return "/departments";
  if (type === "service") return "/services";
  if (type === "availability" || type === "settings") return "/settings";
  return "/notifications/all";
}

export async function appendActivityLog(workspaceId: string | number, entry: ActivityLogEntry) {
  const supabase = createSupabaseServerClient();
  const changed_fields = build_changed_fields(entry.before_data, entry.after_data, entry.changed_fields);
  const before_data = pick_diff_payload(entry.before_data ?? null, changed_fields);
  const after_data = pick_diff_payload(entry.after_data ?? null, changed_fields);
  const target_path = entry.target_path ?? default_target_path(entry.type, entry.entity_id);

  const insert_payload = {
    workspace_id: workspaceId,
    actor_user_id: entry.actor_user_id ?? null,
    entity_type: entry.type,
    entity_id: entry.entity_id != null ? String(entry.entity_id) : null,
    action: entry.action as ActivityAction,
    title: entry.title,
    description: entry.description || "",
    before_data,
    after_data,
    changed_fields,
    target_path,
    metadata: (entry.metadata ?? {}) as Record<string, unknown>,
  };

  const { error } = await supabase.from("activity_events").insert(insert_payload);
  if (error) {
    throw new Error(`Failed to append activity event: ${error.message}`);
  }
}
