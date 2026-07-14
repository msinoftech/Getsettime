export type department_color_id =
  | "violet"
  | "sky"
  | "teal"
  | "lime"
  | "amber"
  | "orange"
  | "pink"
  | "slate";

export const DEPARTMENT_COLORS: {
  id: department_color_id;
  swatch: string;
  gradient: string;
  ring: string;
}[] = [
  {
    id: "violet",
    swatch: "bg-violet-600",
    gradient: "from-violet-500 to-indigo-600",
    ring: "ring-violet-300",
  },
  {
    id: "sky",
    swatch: "bg-sky-500",
    gradient: "from-sky-400 to-blue-600",
    ring: "ring-sky-300",
  },
  {
    id: "teal",
    swatch: "bg-teal-500",
    gradient: "from-teal-400 to-emerald-600",
    ring: "ring-teal-300",
  },
  {
    id: "lime",
    swatch: "bg-lime-500",
    gradient: "from-lime-400 to-green-600",
    ring: "ring-lime-300",
  },
  {
    id: "amber",
    swatch: "bg-amber-400",
    gradient: "from-amber-400 to-yellow-600",
    ring: "ring-amber-300",
  },
  {
    id: "orange",
    swatch: "bg-orange-500",
    gradient: "from-orange-400 to-rose-500",
    ring: "ring-orange-300",
  },
  {
    id: "pink",
    swatch: "bg-pink-500",
    gradient: "from-pink-500 to-fuchsia-600",
    ring: "ring-pink-300",
  },
  {
    id: "slate",
    swatch: "bg-slate-500",
    gradient: "from-slate-400 to-slate-700",
    ring: "ring-slate-300",
  },
];

export const DEFAULT_DEPARTMENT_COLOR: department_color_id = "violet";

const DEPARTMENT_COLOR_IDS = new Set<string>(
  DEPARTMENT_COLORS.map((c) => c.id)
);

export function parse_department_color(raw: unknown): department_color_id | null {
  if (typeof raw !== "string") return null;
  return DEPARTMENT_COLOR_IDS.has(raw) ? (raw as department_color_id) : null;
}

export function get_department_gradient(department: {
  id: number;
  meta_data?: { color?: string | null } | null;
}): string {
  const colorId = parse_department_color(department.meta_data?.color);
  if (colorId) {
    const match = DEPARTMENT_COLORS.find((c) => c.id === colorId);
    if (match) return match.gradient;
  }
  return DEPARTMENT_COLORS[Math.abs(department.id) % DEPARTMENT_COLORS.length]
    .gradient;
}
