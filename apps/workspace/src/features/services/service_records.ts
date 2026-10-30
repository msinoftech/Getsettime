import type { IconType } from "react-icons";
import {
  LuFileText as FileText,
  LuGlobe as Globe,
  LuLock as Lock,
} from "react-icons/lu";

/** Public=active, Private=private, Draft=draft; inactive kept for legacy rows. */
export type service_status = "active" | "private" | "draft" | "inactive";
export type service_visibility_status = "active" | "private" | "draft";

export type service_provider_meta = {
  id: string;
  name: string;
};

/** Row shape returned by `/api/services`. */
export type service_record = {
  id: string;
  workspace_id: number;
  name: string;
  description: string | null;
  price: number | null;
  duration: number;
  status: service_status;
  flag: boolean;
  department_id: number | null;
  departments?: { name: string } | { name: string }[] | null;
  meta_data: {
    service_providers?: service_provider_meta[];
  } | null;
  created_at: string;
  updated_at: string;
};

/** Minimal department shape needed by the service form. */
export type service_department_option = {
  id: number;
  name: string;
};

/** Minimal service shape needed for duplicate-name checks. */
export type service_name_record = {
  id: string;
  name: string;
  department_id: number | null;
};

export type service_doctor_row = {
  id: string;
  name: string;
  role: string;
  avatar: string;
  avatarUrl: string | null;
};

export type service_doctor_assign_mode = "all" | "specific";

export const SERVICE_DURATION_OPTIONS: readonly number[] = [
  15, 20, 30, 40, 45, 60,
];
export const SERVICE_DESCRIPTION_MAX_LENGTH = 150;

export const SERVICE_VISIBILITY_OPTIONS: readonly {
  value: service_visibility_status;
  label: string;
  Icon: IconType;
}[] = [
  { value: "active", label: "Public", Icon: Globe },
  { value: "private", label: "Private", Icon: Lock },
  { value: "draft", label: "Draft", Icon: FileText },
];

export function service_visibility_from_status(
  status: service_status
): service_visibility_status {
  if (status === "active") return "active";
  if (status === "draft") return "draft";
  return "private";
}

export function parse_service_price_input(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** "all" assigns every department consultant, "specific" only the picked ones. */
export function resolve_assigned_doctor_ids(
  mode: service_doctor_assign_mode,
  selectedIds: readonly string[],
  pool: readonly service_doctor_row[]
): string[] {
  if (mode === "all") return pool.map((doctor) => doctor.id);
  const poolIds = new Set(pool.map((doctor) => doctor.id));
  return selectedIds.filter((id) => poolIds.has(id));
}
