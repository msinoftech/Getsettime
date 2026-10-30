"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

export function overflow_parent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.body) {
    const overflow_y = getComputedStyle(node).overflowY;
    if (overflow_y === "auto" || overflow_y === "scroll" || overflow_y === "hidden") {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export function should_open_picker_above(field: HTMLElement, dialog: HTMLElement): boolean {
  const field_rect = field.getBoundingClientRect();
  const dialog_h = dialog.offsetHeight;
  const parent_rect = overflow_parent(field)?.getBoundingClientRect();
  const clip_top = Math.max(0, parent_rect?.top ?? 0);
  const clip_bottom = Math.min(window.innerHeight, parent_rect?.bottom ?? window.innerHeight);
  const gap = 6;
  const space_below = clip_bottom - field_rect.bottom - gap;
  const space_above = field_rect.top - clip_top - gap;
  return space_below < dialog_h && space_above > space_below;
}

export const PICKER_OVERLAY_BASE =
  "absolute left-0 z-30 w-[17rem] max-w-full rounded-xl border border-slate-200 bg-white p-2 shadow-lg";

export function picker_overlay_class(open_above: boolean): string {
  return `${PICKER_OVERLAY_BASE} ${open_above ? "bottom-full mb-1" : "top-full mt-1"}`;
}

export function use_picker_overlay_placement(
  open: boolean,
  root_ref: RefObject<HTMLElement | null>,
  dialog_ref: RefObject<HTMLElement | null>,
  layout_key?: string | number | boolean
): boolean {
  const [open_above, set_open_above] = useState(false);

  useLayoutEffect(() => {
    if (!open) {
      set_open_above(false);
      return;
    }
    const update = () => {
      const field = root_ref.current;
      const dialog = dialog_ref.current;
      if (!field || !dialog) return;
      set_open_above(should_open_picker_above(field, dialog));
    };
    update();
    const frame = window.requestAnimationFrame(update);
    const scroll_root = root_ref.current ? overflow_parent(root_ref.current) : null;
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    scroll_root?.addEventListener("scroll", update, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      scroll_root?.removeEventListener("scroll", update);
    };
  }, [open, layout_key, root_ref, dialog_ref]);

  return open_above;
}
