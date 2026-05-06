"use client";

import { useEffect } from "react";

/**
 * Wires the data-print-trigger button on the print page to window.print(),
 * plus also responds to Cmd/Ctrl+P naturally (browser default).
 *
 * We intentionally do NOT auto-print on load — too jarring. The button is
 * one click away and Cmd+P also works.
 */
export function TimelinePrintAuto() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      const button = el.closest('[data-print-trigger="true"]');
      if (button) {
        e.preventDefault();
        window.print();
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);
  return null;
}
