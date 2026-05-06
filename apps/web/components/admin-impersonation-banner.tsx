"use client";

import { Eye, X } from "lucide-react";

export function ImpersonationBanner({
  workspaceName,
}: {
  workspaceName: string;
}) {
  const exit = async () => {
    await fetch("/api/admin/impersonate", { method: "DELETE" });
    window.location.href = "/admin";
  };

  return (
    <div className="border-b border-amber-300 bg-gradient-to-r from-amber-100 via-amber-50 to-amber-100 px-4 py-2 text-sm text-amber-900">
      <div className="container flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Eye className="h-3.5 w-3.5" />
          <span className="font-medium">Viewing as:</span>
          <span>{workspaceName}</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-amber-800">
            org_admin preview
          </span>
        </div>
        <button
          type="button"
          onClick={exit}
          className="inline-flex items-center gap-1 rounded-full border border-amber-400 bg-white px-3 py-1 text-xs font-medium text-amber-900 transition hover:bg-amber-50"
        >
          <X className="h-3 w-3" />
          Exit & return to studio
        </button>
      </div>
    </div>
  );
}
