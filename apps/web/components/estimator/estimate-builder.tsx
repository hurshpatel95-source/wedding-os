"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Check,
  X,
  RotateCcw,
  AlertCircle,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  documentBaseline,
  documentOverrideDelta,
  documentTotal,
  effectiveLineTotal,
  formatEUR,
  lineDelta,
  sectionBaseline,
  sectionTotal,
  type EstimateDocument,
  type EstimateLine,
  type EstimateSection,
} from "@/lib/estimator-types";

interface Props {
  id: string;
  initialDoc: EstimateDocument;
  baselineTotal: number | null;
  guestCount: number | null;
}

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; msg: string };

export function EstimateBuilder({
  id,
  initialDoc,
  baselineTotal,
  guestCount,
}: Props) {
  const [doc, setDoc] = useState<EstimateDocument>(initialDoc);
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(initialDoc.sections.map((s) => s.id)),
  );
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const docRef = useRef(initialDoc);

  // Debounced auto-save on doc change
  useEffect(() => {
    if (doc === initialDoc) return; // first render, skip
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveState({ kind: "saving" });
      try {
        const res = await fetch(`/api/estimator/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sections: doc }),
        });
        if (!res.ok) {
          const txt = await res.text();
          setSaveState({ kind: "error", msg: txt || `HTTP ${res.status}` });
          return;
        }
        setSaveState({ kind: "saved", at: Date.now() });
      } catch (err) {
        setSaveState({ kind: "error", msg: (err as Error).message });
      }
    }, 700);
    docRef.current = doc;
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [doc, id, initialDoc]);

  const total = useMemo(() => documentTotal(doc), [doc]);
  const baseline = useMemo(() => documentBaseline(doc), [doc]);
  const delta = useMemo(() => documentOverrideDelta(doc), [doc]);
  const printedBaseline = baselineTotal ?? baseline;

  function toggleSection(sid: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }

  function updateLine(
    sectionId: string,
    lineId: string,
    patch: Partial<EstimateLine>,
  ) {
    setDoc((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              lines: s.lines.map((l) => (l.id !== lineId ? l : { ...l, ...patch })),
            },
      ),
    }));
  }

  function addLine(sectionId: string) {
    const newLine: EstimateLine = {
      id: `user-${Date.now()}`,
      label: "New line",
      unit_label: "flat",
      astha_eur: 0,
      override_eur: 0,
      included: true,
      user_added: true,
    };
    setDoc((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id !== sectionId ? s : { ...s, lines: [...s.lines, newLine] },
      ),
    }));
  }

  function removeLine(sectionId: string, lineId: string) {
    setDoc((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id !== sectionId
          ? s
          : { ...s, lines: s.lines.filter((l) => l.id !== lineId) },
      ),
    }));
  }

  return (
    <div className="space-y-5">
      {/* Sticky summary bar */}
      <div className="sticky top-16 z-30 -mx-4 border-y border-stone-200 bg-stone-50/90 px-4 py-3 backdrop-blur md:rounded-xl md:border md:bg-white">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Effective total
            </div>
            <div className="font-serif text-3xl font-medium tracking-tight md:text-4xl">
              {formatEUR(total)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              baseline {formatEUR(printedBaseline)}
            </span>
            {Math.abs(delta) > 0.5 && (
              <Badge
                variant={delta < 0 ? "success" : "warning"}
                className="text-[10px]"
              >
                {delta < 0 ? "−" : "+"}
                {formatEUR(Math.abs(delta))} your edits
              </Badge>
            )}
            {guestCount && (
              <span className="text-muted-foreground">
                {Math.round(total / guestCount).toLocaleString()}{" "}
                <span className="text-[10px] uppercase">€/guest</span>
              </span>
            )}
            <SaveIndicator state={saveState} />
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {doc.sections.map((section) => (
          <SectionBlock
            key={section.id}
            section={section}
            isOpen={openSections.has(section.id)}
            onToggleOpen={() => toggleSection(section.id)}
            onUpdateLine={(lineId, patch) =>
              updateLine(section.id, lineId, patch)
            }
            onAddLine={() => addLine(section.id)}
            onRemoveLine={(lineId) => removeLine(section.id, lineId)}
          />
        ))}
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state.kind === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-stone-500">
        Saving…
      </span>
    );
  }
  if (state.kind === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-emerald-700">
        <Check className="h-3 w-3" />
        Saved
      </span>
    );
  }
  if (state.kind === "error") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-rose-700"
        title={state.msg}
      >
        <AlertCircle className="h-3 w-3" />
        Error
      </span>
    );
  }
  return null;
}

// ─── Section ─────────────────────────────────────────────────────────────

interface SectionProps {
  section: EstimateSection;
  isOpen: boolean;
  onToggleOpen: () => void;
  onUpdateLine: (lineId: string, patch: Partial<EstimateLine>) => void;
  onAddLine: () => void;
  onRemoveLine: (lineId: string) => void;
}

function SectionBlock({
  section,
  isOpen,
  onToggleOpen,
  onUpdateLine,
  onAddLine,
  onRemoveLine,
}: SectionProps) {
  const total = sectionTotal(section);
  const baseline = sectionBaseline(section);
  const delta = total - baseline;

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-2">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-stone-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-stone-500" />
            )}
            <div>
              <div className="font-serif text-xl">{section.label}</div>
              {section.subtitle && (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {section.subtitle}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="font-serif text-xl font-medium">
              {formatEUR(total)}
            </div>
            {Math.abs(delta) > 0.5 && (
              <div
                className={cn(
                  "text-[10px] uppercase tracking-[0.15em]",
                  delta < 0 ? "text-emerald-700" : "text-amber-700",
                )}
              >
                {delta < 0 ? "−" : "+"}
                {formatEUR(Math.abs(delta))}
              </div>
            )}
          </div>
        </button>

        {isOpen && (
          <>
            {section.notes && (
              <div className="rounded-md bg-stone-50 px-3 py-2 text-xs text-stone-600">
                {section.notes}
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-stone-200">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-stone-50 text-[10px] uppercase tracking-[0.15em] text-stone-500">
                  <tr>
                    <th className="w-8 px-2 py-2"></th>
                    <th className="px-3 py-2 text-left">Line</th>
                    <th className="px-3 py-2 text-left">Unit</th>
                    <th className="px-3 py-2 text-right">Astia</th>
                    <th className="px-3 py-2 text-right">Yours</th>
                    <th className="px-3 py-2 text-right">Effective</th>
                    <th className="w-8 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {section.lines.map((line) => (
                    <LineRow
                      key={line.id}
                      line={line}
                      onUpdate={(patch) => onUpdateLine(line.id, patch)}
                      onRemove={() => onRemoveLine(line.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <Button
                type="button"
                onClick={onAddLine}
                size="sm"
                variant="ghost"
                className="text-xs"
              >
                <Plus className="mr-1 h-3 w-3" />
                Add line
              </Button>
              <div className="text-[10px] uppercase tracking-[0.15em] text-stone-500">
                {section.lines.length} lines · baseline {formatEUR(baseline)}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Line ────────────────────────────────────────────────────────────────

interface LineRowProps {
  line: EstimateLine;
  onUpdate: (patch: Partial<EstimateLine>) => void;
  onRemove: () => void;
}

function LineRow({ line, onUpdate, onRemove }: LineRowProps) {
  const effective = effectiveLineTotal(line);
  const delta = lineDelta(line);
  const dimmed = !line.included;

  return (
    <tr
      className={cn(
        "border-t border-stone-100 transition",
        dimmed && "bg-stone-50/40 text-stone-400",
      )}
    >
      <td className="px-2 py-2">
        <input
          type="checkbox"
          checked={line.included}
          onChange={(e) => onUpdate({ included: e.target.checked })}
          className="h-4 w-4 cursor-pointer rounded border-stone-300 text-rose-600 focus:ring-rose-400"
          aria-label="Include line"
        />
      </td>
      <td className="px-3 py-2">
        {line.user_added ? (
          <Input
            value={line.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="h-7 text-sm"
          />
        ) : (
          <div>
            <div className="font-medium text-stone-900 group-disabled:text-stone-400">
              {line.label}
            </div>
            {line.evidence?.quote && (
              <div
                className="mt-0.5 max-w-md truncate text-[10px] italic text-stone-400"
                title={`Astia quote: "${line.evidence.quote}"${
                  line.evidence.page ? ` (PDF p.${line.evidence.page})` : ""
                }`}
              >
                &ldquo;{line.evidence.quote}&rdquo;
              </div>
            )}
            {line.tbc && (
              <Badge variant="muted" className="mt-1 text-[10px]">
                TBC by Astha
              </Badge>
            )}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {line.unit_label ?? "flat"}
      </td>
      <td className="px-3 py-2 text-right text-xs text-stone-500">
        {line.user_added ? "—" : formatEUR(line.astha_eur)}
      </td>
      <td className="px-3 py-2 text-right">
        <PriceEditor
          value={line.override_eur}
          baseline={line.astha_eur}
          disabled={!line.included || Boolean(line.tbc)}
          onChange={(v) => onUpdate({ override_eur: v })}
        />
      </td>
      <td
        className={cn(
          "px-3 py-2 text-right font-medium tabular-nums",
          line.tbc && "text-stone-400",
        )}
      >
        {line.tbc ? "TBC" : formatEUR(effective)}
        {Math.abs(delta) > 0.5 && line.included && !line.tbc && (
          <div
            className={cn(
              "text-[10px] uppercase tracking-[0.15em]",
              delta < 0 ? "text-emerald-700" : "text-amber-700",
            )}
          >
            {delta < 0 ? "−" : "+"}
            {formatEUR(Math.abs(delta))}
          </div>
        )}
      </td>
      <td className="px-2 py-2 text-right">
        {line.user_added && (
          <button
            type="button"
            onClick={onRemove}
            className="text-stone-300 transition hover:text-rose-600"
            aria-label="Remove line"
            title="Remove this line"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Inline price editor ─────────────────────────────────────────────────

function PriceEditor({
  value,
  baseline,
  disabled,
  onChange,
}: {
  value: number | null;
  baseline: number;
  disabled: boolean;
  onChange: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(
    value != null ? String(value) : "",
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed === "") {
      onChange(null);
    } else {
      const n = Number(trimmed.replace(/[€,\s]/g, ""));
      if (Number.isFinite(n)) onChange(n);
    }
    setEditing(false);
  }

  function cancel() {
    setDraft(value != null ? String(value) : "");
    setEditing(false);
  }

  function reset() {
    onChange(null);
    setDraft("");
  }

  if (disabled) {
    return <span className="text-stone-300">—</span>;
  }

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          onBlur={commit}
          className="h-7 w-24 text-right text-sm tabular-nums"
          inputMode="decimal"
        />
      </div>
    );
  }

  if (value == null) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(String(baseline));
          setEditing(true);
        }}
        className="text-xs italic text-stone-400 transition hover:text-stone-700"
      >
        edit
      </button>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => {
          setDraft(String(value));
          setEditing(true);
        }}
        className="font-medium tabular-nums text-stone-900 transition hover:text-rose-700"
      >
        {formatEUR(value)}
      </button>
      <button
        type="button"
        onClick={reset}
        className="text-stone-300 transition hover:text-stone-700"
        aria-label="Reset to Astia's baseline"
        title="Reset to Astia's baseline"
      >
        <RotateCcw className="h-3 w-3" />
      </button>
    </div>
  );
}
