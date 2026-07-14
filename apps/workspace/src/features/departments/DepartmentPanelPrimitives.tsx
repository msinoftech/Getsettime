"use client";

import type { ReactNode } from "react";
import { LuCheck as Check } from "react-icons/lu";
import {
  DEPARTMENT_COLORS,
  type department_color_id,
} from "@/src/features/departments/department_colors";

export function classNames(
  ...classes: Array<string | false | null | undefined>
) {
  return classes.filter(Boolean).join(" ");
}

export function PanelSection({
  number,
  title,
  children,
  isLast = false,
}: {
  number: number;
  title: string;
  children: ReactNode;
  isLast?: boolean;
}) {
  return (
    <section className={isLast ? "p-4" : "border-b border-slate-200 p-4"}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
          {number}
        </span>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function DepartmentColorPicker({
  value,
  onChange,
}: {
  value: department_color_id;
  onChange: (next: department_color_id) => void;
}) {
  return (
    <div>
      <p className="mb-2.5 text-sm font-medium text-slate-700">Department color</p>
      <div className="flex flex-wrap gap-2.5">
        {DEPARTMENT_COLORS.map((color) => {
          const selected = value === color.id;
          return (
            <button
              key={color.id}
              type="button"
              onClick={() => onChange(color.id)}
              aria-label={`Select ${color.id} department color`}
              aria-pressed={selected}
              className={classNames(
                "flex h-8 w-8 items-center justify-center rounded-full transition",
                color.swatch,
                selected && `ring-2 ring-offset-2 ${color.ring}`
              )}
            >
              {selected && <Check className="h-3.5 w-3.5 text-white" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProviderAvatar({
  name,
  initials,
  avatarUrl,
  size = "md",
}: {
  name: string;
  initials: string;
  avatarUrl?: string | null;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-sm";
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={classNames(sizeClass, "shrink-0 rounded-full object-cover")}
      />
    );
  }
  return (
    <span
      className={classNames(
        sizeClass,
        "flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700"
      )}
    >
      {initials}
    </span>
  );
}

export function provider_initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].replace(/^Dr\.?$/i, "");
  if (parts.length === 1) return (first || parts[0]).slice(0, 2).toUpperCase();
  const primary = first || parts[1] || "";
  const secondary = parts[parts.length - 1] || "";
  const a = primary.charAt(0);
  const b = secondary.charAt(0);
  return (a + b).toUpperCase() || parts[0].slice(0, 2).toUpperCase();
}
