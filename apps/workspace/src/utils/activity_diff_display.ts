import {
  format_event_type_location_labels,
  parse_event_type_location_types,
} from "@/src/types/event_type_location";

type activity_diff_source = {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  changedFields?: string[];
};

const ACTIVITY_FIELD_LABELS: Record<string, string> = {
  location_type: "Meeting type",
};

type scalar_diff = {
  path: string;
  before: string;
  after: string;
};

const MAX_DETAIL_LINES = 4;
const MAX_SCALAR_DIFFS_PER_FIELD = 6;
const MAX_VALUE_LENGTH = 72;
function is_record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function label_for_activity_field(field: string): string {
  const key = field.includes(".") ? field.split(".").pop() ?? field : field;
  return ACTIVITY_FIELD_LABELS[key] ?? field;
}

function format_location_type_value(value: unknown): string {
  if (value === null || value === undefined) {
    return format_event_type_location_labels([]);
  }
  const raw =
    typeof value === "string"
      ? value
      : Array.isArray(value)
        ? value.map((item) => String(item).trim()).filter(Boolean).join(",")
        : String(value);
  return format_event_type_location_labels(parse_event_type_location_types(raw));
}

function format_activity_field_scalar(field: string, value: unknown): string | null {
  const field_key = field.includes(".") ? field.split(".").pop() ?? field : field;
  if (field_key === "location_type") {
    return format_location_type_value(value);
  }
  return format_scalar(value);
}

function format_scalar(value: unknown): string | null {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "—";
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "—";
    return trimmed.length > MAX_VALUE_LENGTH
      ? `${trimmed.slice(0, MAX_VALUE_LENGTH)}…`
      : trimmed;
  }
  return null;
}

function values_equal(a: unknown, b: unknown): boolean {
  return (JSON.stringify(a) ?? "") === (JSON.stringify(b) ?? "");
}

function collect_scalar_diffs(
  before: unknown,
  after: unknown,
  path: string,
  depth: number,
  results: scalar_diff[]
): void {
  if (results.length >= MAX_SCALAR_DIFFS_PER_FIELD) return;

  const before_scalar = format_scalar(before);
  const after_scalar = format_scalar(after);
  if (before_scalar !== null && after_scalar !== null) {
    if (!values_equal(before, after)) {
      results.push({ path, before: before_scalar, after: after_scalar });
    }
    return;
  }

  if (depth <= 0) return;

  if (is_record(before) || is_record(after)) {
    const before_record = is_record(before) ? before : {};
    const after_record = is_record(after) ? after : {};
    const keys = new Set([...Object.keys(before_record), ...Object.keys(after_record)]);
    for (const key of keys) {
      const next_path = path ? `${path}.${key}` : key;
      collect_scalar_diffs(
        before_record[key],
        after_record[key],
        next_path,
        depth - 1,
        results
      );
      if (results.length >= MAX_SCALAR_DIFFS_PER_FIELD) break;
    }
    return;
  }

  if (Array.isArray(before) || Array.isArray(after)) {
    if (!values_equal(before, after)) {
      const before_len = Array.isArray(before) ? before.length : 0;
      const after_len = Array.isArray(after) ? after.length : 0;
      if (before_len !== after_len) {
        results.push({
          path,
          before: `${before_len} items`,
          after: `${after_len} items`,
        });
      }
    }
  }
}

function summarize_complex_field_change(
  field: string,
  before: unknown,
  after: unknown
): string {
  if (Array.isArray(before) || Array.isArray(after)) {
    const before_len = Array.isArray(before) ? before.length : 0;
    const after_len = Array.isArray(after) ? after.length : 0;
    if (before_len !== after_len) {
      return `${field}: ${before_len} items → ${after_len} items`;
    }
    return `${field}: list updated`;
  }
  return `${field}: updated`;
}

function collect_scalar_diffs_for_field(
  field: string,
  before: unknown,
  after: unknown
): scalar_diff[] {
  const results: scalar_diff[] = [];
  collect_scalar_diffs(before, after, field, 3, results);
  return results;
}

function diff_line(diff: scalar_diff): string {
  const label = label_for_activity_field(diff.path);
  return `${label}: ${diff.before} → ${diff.after}`;
}

export function build_activity_diff_display(
  item: activity_diff_source
): { changed_summary: string | null; detail_lines: string[] } {
  const changed_fields = Array.isArray(item.changedFields)
    ? item.changedFields.filter((field) => typeof field === "string" && field.trim())
    : [];

  if (changed_fields.length === 0) {
    return { changed_summary: null, detail_lines: [] };
  }

  const detail_lines: string[] = [];
  const summary_paths: string[] = [];

  for (const field of changed_fields) {
    const before_value = item.before?.[field];
    const after_value = item.after?.[field];

    const before_scalar = format_activity_field_scalar(field, before_value);
    const after_scalar = format_activity_field_scalar(field, after_value);
    if (before_scalar !== null && after_scalar !== null) {
      const field_label = label_for_activity_field(field);
      detail_lines.push(`${field_label}: ${before_scalar} → ${after_scalar}`);
      summary_paths.push(field_label);
      continue;
    }

    const nested_diffs = collect_scalar_diffs_for_field(field, before_value, after_value);

    if (nested_diffs.length > 0 && nested_diffs.length <= MAX_DETAIL_LINES) {
      for (const diff of nested_diffs) {
        detail_lines.push(diff_line(diff));
        summary_paths.push(diff.path);
      }
      continue;
    }

    if (nested_diffs.length > MAX_DETAIL_LINES) {
      detail_lines.push(`${field}: ${nested_diffs.length} settings updated`);
      summary_paths.push(
        ...nested_diffs.slice(0, MAX_DETAIL_LINES).map((diff) => diff.path)
      );
      continue;
    }

    if (!values_equal(before_value, after_value)) {
      detail_lines.push(
        summarize_complex_field_change(field, before_value, after_value)
      );
      summary_paths.push(field);
    }
  }

  const changed_summary =
    summary_paths.length > 0
      ? summary_paths.slice(0, 6).join(", ")
      : changed_fields.slice(0, 4).join(", ");

  return {
    changed_summary,
    detail_lines: detail_lines.slice(0, MAX_DETAIL_LINES),
  };
}
