"use client";

import { useEffect, useState, type ReactNode } from "react";

type ScreenGateProps = {
  children: ReactNode;
  fallback?: ReactNode;
  /** Render children when viewport width is >= this value (px). */
  minWidth?: number;
  /** Render children when viewport width is <= this value (px). */
  maxWidth?: number;
};

function buildMediaQuery(minWidth?: number, maxWidth?: number): string | null {
  const conditions: string[] = [];

  if (minWidth !== undefined) {
    conditions.push(`(min-width: ${minWidth}px)`);
  }

  if (maxWidth !== undefined) {
    conditions.push(`(max-width: ${maxWidth}px)`);
  }

  if (conditions.length === 0) {
    return null;
  }

  return conditions.join(" and ");
}

export default function ScreenGate({
  children,
  fallback = null,
  minWidth,
  maxWidth,
}: ScreenGateProps) {
  const [matches, setMatches] = useState<boolean | null>(null);

  useEffect(() => {
    const query = buildMediaQuery(minWidth, maxWidth);

    if (!query) {
      setMatches(true);
      return;
    }

    const mediaQuery = window.matchMedia(query);
    const update = () => setMatches(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, [minWidth, maxWidth]);

  if (matches === null) {
    return null;
  }

  if (!matches) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}