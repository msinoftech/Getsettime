"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { LuCheck, LuCopy, LuEllipsisVertical, LuLink2, LuTrash2 } from "react-icons/lu";

const MENU_WIDTH = 176;
const MENU_HEIGHT = 132;
const MENU_GAP = 4;

type MenuPosition = {
  top: number;
  left: number;
};

type EventTypeActionsMenuProps = {
  open: boolean;
  copy_disabled: boolean;
  copy_copied: boolean;
  on_toggle: () => void;
  on_copy_link: () => void | Promise<void>;
  on_duplicate: () => void;
  on_delete: () => void;
};

export function EventTypeActionsMenu({
  open,
  copy_disabled,
  copy_copied,
  on_toggle,
  on_copy_link,
  on_duplicate,
  on_delete,
}: EventTypeActionsMenuProps) {
  const trigger_ref = useRef<HTMLButtonElement>(null);
  const [menu_position, set_menu_position] = useState<MenuPosition | null>(null);
  const [mounted, set_mounted] = useState(false);

  const stop_menu_event = (e: MouseEvent) => {
    e.stopPropagation();
  };

  const update_menu_position = useCallback(() => {
    const trigger = trigger_ref.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const space_below = window.innerHeight - rect.bottom;
    const space_above = rect.top;
    const open_below =
      space_below >= MENU_HEIGHT + MENU_GAP ||
      space_below >= space_above;

    const top = open_below
      ? rect.bottom + MENU_GAP
      : rect.top - MENU_HEIGHT - MENU_GAP;

    const left = Math.min(
      Math.max(rect.right - MENU_WIDTH, MENU_GAP),
      window.innerWidth - MENU_WIDTH - MENU_GAP
    );

    set_menu_position({ top, left });
  }, []);

  useEffect(() => {
    set_mounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      set_menu_position(null);
      return;
    }

    update_menu_position();

    window.addEventListener("resize", update_menu_position);
    window.addEventListener("scroll", update_menu_position, true);

    return () => {
      window.removeEventListener("resize", update_menu_position);
      window.removeEventListener("scroll", update_menu_position, true);
    };
  }, [open, update_menu_position]);

  return (
    <div
      className="relative"
      data-event-type-actions-menu
      onMouseDown={stop_menu_event}
    >
      <button
        ref={trigger_ref}
        type="button"
        onClick={on_toggle}
        className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-50"
        aria-label="More actions"
        aria-expanded={open}
      >
        <LuEllipsisVertical className="h-4 w-4" />
      </button>
      {open && mounted && menu_position
        ? createPortal(
            <div
              data-event-type-actions-menu
              className="fixed z-[100] w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
              style={{
                top: menu_position.top,
                left: menu_position.left,
              }}
              role="menu"
              onMouseDown={stop_menu_event}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => void on_copy_link()}
                disabled={copy_disabled || copy_copied}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  copy_copied
                    ? "cursor-default text-emerald-600"
                    : "text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                }`}
              >
                {copy_copied ? (
                  <>
                    <LuCheck className="h-4 w-4" aria-hidden />
                    Copied!
                  </>
                ) : (
                  <>
                    <LuLink2 className="h-4 w-4" aria-hidden />
                    Copy link
                  </>
                )}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={on_duplicate}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <LuCopy className="h-4 w-4" aria-hidden />
                Duplicate
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={on_delete}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
              >
                <LuTrash2 className="h-4 w-4" aria-hidden />
                Delete
              </button>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
