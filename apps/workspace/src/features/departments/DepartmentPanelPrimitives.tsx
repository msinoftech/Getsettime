"use client";

import type { ReactNode } from "react";
import { LuCheck as Check } from "react-icons/lu";
import { userInitials } from "@app/ui";
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
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
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

export function provider_initials(name: string): string {
  return userInitials(name);
}
