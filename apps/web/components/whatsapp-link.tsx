"use client";

import { MessageSquare } from "lucide-react";
import { buildWhatsAppLink } from "@/lib/wave2-types";

/**
 * Tap-to-WhatsApp button. Renders nothing if phone is invalid.
 * Used in lead drill, vendor drill, guest list, contract sign page, etc.
 */
export function WhatsAppLink({
  phone,
  text,
  variant = "pill",
  className,
}: {
  phone: string | null | undefined;
  text?: string;
  variant?: "pill" | "icon" | "row";
  className?: string;
}) {
  const url = buildWhatsAppLink(phone, text);
  if (!url) return null;

  if (variant === "icon") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title={`WhatsApp ${phone}`}
        className={
          "inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100 " +
          (className ?? "")
        }
      >
        <MessageSquare className="h-3.5 w-3.5" />
        <span className="sr-only">Open in WhatsApp</span>
      </a>
    );
  }

  if (variant === "row") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={
          "inline-flex items-center gap-2 text-sm text-emerald-700 hover:text-emerald-900 " +
          (className ?? "")
        }
      >
        <MessageSquare className="h-3.5 w-3.5" />
        WhatsApp
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={
        "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-100 " +
        (className ?? "")
      }
    >
      <MessageSquare className="h-3 w-3" />
      WhatsApp
    </a>
  );
}
