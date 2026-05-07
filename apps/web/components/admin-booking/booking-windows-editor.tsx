"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DAY_OF_WEEK_LABELS,
  hhmmToMinutes,
  minutesToHHMM,
  type BookingWindowRow,
} from "@/lib/lead-types";

interface DraftRow {
  id?: string;          // existing id if persisted, undefined if newly added
  day_of_week: number;
  start: string;        // HH:MM
  end: string;          // HH:MM
  label: string;
}

function rowsFromExisting(rows: BookingWindowRow[]): DraftRow[] {
  return rows.map((r) => ({
    id: r.id,
    day_of_week: r.day_of_week,
    start: minutesToHHMM(r.start_minute),
    end: minutesToHHMM(r.end_minute),
    label: r.label ?? "",
  }));
}

export function BookingWindowsEditor({
  windows,
  published,
  publicSlug,
}: {
  windows: BookingWindowRow[];
  published: boolean;
  publicSlug: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftRow[]>(rowsFromExisting(windows));
  const [busy, setBusy] = useState(false);

  const addRow = () => {
    setDraft((d) => [
      ...d,
      { day_of_week: 2, start: "10:00", end: "12:00", label: "" },
    ]);
  };

  const removeRow = (i: number) =>
    setDraft((d) => d.filter((_, idx) => idx !== i));

  const update = (i: number, patch: Partial<DraftRow>) =>
    setDraft((d) => d.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = async () => {
    // Validate
    const cleaned = draft
      .map((r) => {
        const start_minute = hhmmToMinutes(r.start);
        const end_minute = hhmmToMinutes(r.end);
        if (end_minute <= start_minute) return null;
        return {
          id: r.id,
          day_of_week: r.day_of_week,
          start_minute,
          end_minute,
          label: r.label.trim() || null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    setBusy(true);
    try {
      const res = await fetch("/api/admin/booking/windows", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ windows: cleaned }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not save");
      }
      toast.success(`Saved ${cleaned.length} windows`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-light tracking-tight">
            When can you take calls?
          </h2>
          <p className="text-xs text-stone-500">
            Recurring weekly availability. The booking page generates 45-min
            slots for the next 21 days from these rules.
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-500"
        >
          <Plus className="h-3 w-3" />
          Add window
        </button>
      </div>

      {draft.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-6 py-8 text-center">
          <p className="text-sm text-stone-500">
            No availability windows yet. Add at least one — e.g. Tue/Thu 10-12.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {draft.map((row, i) => (
            <li
              key={row.id ?? `new-${i}`}
              className="grid grid-cols-1 gap-2 rounded-lg border border-stone-100 bg-stone-50/40 p-3 md:grid-cols-[1fr_1fr_1fr_2fr_auto] md:items-center md:gap-3"
            >
              <select
                value={row.day_of_week}
                onChange={(e) => update(i, { day_of_week: Number(e.target.value) })}
                className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm"
              >
                {DAY_OF_WEEK_LABELS.map((label, idx) => (
                  <option key={idx} value={idx}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={row.start}
                onChange={(e) => update(i, { start: e.target.value })}
                className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm"
              />
              <input
                type="time"
                value={row.end}
                onChange={(e) => update(i, { end: e.target.value })}
                className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm"
              />
              <input
                type="text"
                value={row.label}
                placeholder="Label (optional) — e.g. Morning consults"
                onChange={(e) => update(i, { label: e.target.value })}
                className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="inline-flex items-center justify-center rounded-md border border-rose-200 bg-white p-1.5 text-rose-700 hover:bg-rose-50"
                title="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
        <p className="text-xs text-stone-500">
          {published && publicSlug ? (
            <>
              Live at{" "}
              <a
                href={`/book/${publicSlug}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-stone-700 underline"
              >
                /book/{publicSlug}
              </a>
            </>
          ) : (
            <>Publish your listing above to share the link.</>
          )}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save windows"}
        </button>
      </div>
    </section>
  );
}
