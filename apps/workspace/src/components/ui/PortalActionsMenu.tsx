"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { LuEllipsisVertical as EllipsisVertical } from "react-icons/lu";

const MENU_WIDTH = 176;
const MENU_GAP = 4;
const DEFAULT_MENU_HEIGHT = 96;

type MenuPosition = {
  top: number;
  left: number;
};

type PortalActionsMenuProps = {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** Approximate menu height used before the portal measures itself. */
  estimatedHeight?: number;
  triggerClassName?: string;
};

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function PortalActionsMenu({
  open,
  onToggle,
  children,
  estimatedHeight = DEFAULT_MENU_HEIGHT,
  triggerClassName,
}: PortalActionsMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [mounted, setMounted] = useState(false);

  const stopMenuEvent = (e: MouseEvent) => {
    e.stopPropagation();
  };

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setMenuPosition(null);
      return;
    }

    const measuredHeight = menuRef.current?.offsetHeight ?? 0;
    const menuHeight =
      measuredHeight > 0 ? measuredHeight : estimatedHeight;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openBelow =
      spaceBelow >= menuHeight + MENU_GAP || spaceBelow >= spaceAbove;

    const top = openBelow
      ? rect.bottom + MENU_GAP
      : rect.top - menuHeight - MENU_GAP;

    const left = Math.min(
      Math.max(rect.right - MENU_WIDTH, MENU_GAP),
      window.innerWidth - MENU_WIDTH - MENU_GAP
    );

    setMenuPosition({ top, left });
  }, [estimatedHeight]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    updateMenuPosition();
    const frame = requestAnimationFrame(() => updateMenuPosition());

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition, children]);

  return (
    <div
      className="relative"
      data-portal-actions-menu
      onMouseDown={stopMenuEvent}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        className={classNames(
          "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50",
          triggerClassName
        )}
        aria-label="More actions"
        aria-expanded={open}
      >
        <EllipsisVertical className="h-4 w-4" />
      </button>
      {open && mounted && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              data-portal-actions-menu
              className="fixed z-[100] w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
              }}
              role="menu"
              onMouseDown={stopMenuEvent}
            >
              {children}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
