"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  name: string;
  cover_emoji: string | null;
}

interface Props {
  all: Item[];
  selectedIds: string[];
}

const MAX = 3;

export function CompareSelector({ all, selectedIds }: Props) {
  const router = useRouter();

  const toggle = (id: string) => {
    let next: string[];
    if (selectedIds.includes(id)) {
      // un-select, but keep at least 2 selected
      if (selectedIds.length <= 2) return;
      next = selectedIds.filter((x) => x !== id);
    } else {
      // select, but keep max 3
      if (selectedIds.length >= MAX) return;
      next = [...selectedIds, id];
    }
    const params = new URLSearchParams();
    params.set("ids", next.join(","));
    router.push(`/estimator/compare?${params.toString()}`);
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
        Choose scenarios (2–{MAX})
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {all.map((it) => {
          const checked = selectedIds.includes(it.id);
          const disableSelect = !checked && selectedIds.length >= MAX;
          const disableUnselect = checked && selectedIds.length <= 2;
          const disabled = disableSelect || disableUnselect;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => toggle(it.id)}
              disabled={disabled}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                checked
                  ? "border-rose-500 bg-rose-50 text-rose-900"
                  : "border-stone-200 bg-white text-stone-600 hover:border-stone-400",
                disabled && "cursor-not-allowed opacity-50",
              )}
              title={
                disableSelect
                  ? `Max ${MAX} scenarios at once`
                  : disableUnselect
                  ? "Need at least 2 to compare"
                  : ""
              }
            >
              <span>{it.cover_emoji ?? "💍"}</span>
              {it.name}
              {checked && <span className="text-[10px]">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
