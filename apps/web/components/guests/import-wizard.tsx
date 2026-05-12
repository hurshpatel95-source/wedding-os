"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Upload, FileSpreadsheet, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  GUEST_SIDES,
  IMPORT_FIELD_LABEL,
  RSVP_LABEL,
  SIDE_LABEL,
  type GuestSide,
  type ImportPreview,
  type NormalizedRow,
} from "@/lib/guest-types";

type Stage = "drop" | "uploading" | "preview" | "committing" | "done" | "error";

const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".csv", ".tsv", ".numbers"];
const BAD_FORMAT_MSG =
  "Drop an .xlsx or .csv. Got a PDF? Copy-paste names into a sheet first, then drop here.";

function hasAcceptedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function ImportWizard() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("drop");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [defaultSide, setDefaultSide] = useState<GuestSide | "unset">("unset");
  const [committed, setCommitted] = useState<{ imported: number; skipped: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Inline format-warning shown next to the dropzone when the user drops a
  // PDF / image / unsupported file (audit #25).
  const [formatHint, setFormatHint] = useState<string | null>(null);

  const upload = async (file: File) => {
    // Client-side format gate (audit #25). Server still validates, but we
    // bounce obvious wrong-format drops without spinning up the upload UI.
    if (!hasAcceptedExtension(file.name)) {
      setFormatHint(BAD_FORMAT_MSG);
      return;
    }
    setFormatHint(null);
    setStage("uploading");
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/guests/import", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Upload failed (${res.status})`);
      }
      const data = (await res.json()) as ImportPreview;
      setPreview(data);
      setStage("preview");
    } catch (e) {
      setError((e as Error).message);
      setStage("error");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) upload(f);
  };

  const updateRow = (idx: number, patch: Partial<NormalizedRow>) => {
    setPreview((p) =>
      p
        ? {
            ...p,
            rows: p.rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
          }
        : p,
    );
  };

  const removeRow = (idx: number) => {
    setPreview((p) => (p ? { ...p, rows: p.rows.filter((_, i) => i !== idx) } : p));
  };

  const commit = async () => {
    if (!preview) return;
    setStage("committing");
    setError(null);
    try {
      const res = await fetch("/api/guests/import/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          import_id: preview.import_id,
          rows: preview.rows,
          default_side: defaultSide === "unset" ? null : defaultSide,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Commit failed (${res.status})`);
      }
      const data = (await res.json()) as { imported: number; skipped: number };
      setCommitted(data);
      setStage("done");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setStage("error");
    }
  };

  if (stage === "drop" || stage === "uploading") {
    return (
      <Card>
        <CardContent className="space-y-3 py-8">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              "rounded-2xl border-2 border-dashed p-12 text-center transition-colors",
              dragOver
                ? "border-foreground/40 bg-secondary/40"
                : "border-stone-300 bg-stone-50/50",
            )}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              {stage === "uploading" ? (
                <Sparkles className="h-6 w-6 animate-pulse" />
              ) : (
                <FileSpreadsheet className="h-6 w-6" />
              )}
            </div>
            <h3 className="mt-4 font-serif text-2xl">
              {stage === "uploading" ? "Reading your file…" : "Drop a guest list"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {stage === "uploading"
                ? "Parsing rows + asking Claude to map columns. ~10-30 seconds."
                : "Excel (.xlsx) or CSV. We'll show a preview before anything saves."}
            </p>
            {stage !== "uploading" && (
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" /> Pick a file
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />
            {formatHint && (
              <div
                role="alert"
                className="mx-auto mt-4 max-w-md rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
              >
                <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
                {formatHint}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (stage === "error") {
    return (
      <Card className="border-destructive/40">
        <CardContent className="space-y-3 py-8">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-serif text-xl">Import failed</h3>
          </div>
          <p className="text-sm">{error}</p>
          <Button type="button" variant="outline" onClick={() => setStage("drop")}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (stage === "done" && committed) {
    return (
      <Card className="border-emerald-300/60">
        <CardContent className="space-y-3 py-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="h-6 w-6" />
          </div>
          <h3 className="font-serif text-2xl">
            Imported {committed.imported} guest{committed.imported === 1 ? "" : "s"}
          </h3>
          {committed.skipped > 0 && (
            <p className="text-sm text-muted-foreground">
              {committed.skipped} row{committed.skipped === 1 ? "" : "s"} skipped (missing required
              fields).
            </p>
          )}
          <div className="flex justify-center gap-2 pt-2">
            <Button onClick={() => router.push("/guests")}>Go to guest list</Button>
            <Button
              variant="outline"
              onClick={() => {
                setPreview(null);
                setCommitted(null);
                setStage("drop");
              }}
            >
              Import another
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!preview) return null;

  const validRows = preview.rows.filter((r) => r.full_name && r.full_name.trim());
  const skippedCount = preview.rows.length - validRows.length;

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <Card>
        <CardContent className="space-y-3 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-xl">{preview.source_filename}</h3>
              <p className="text-xs text-muted-foreground">
                {preview.rows_total} row{preview.rows_total === 1 ? "" : "s"} read ·{" "}
                {validRows.length} ready · {skippedCount} skipped
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={preview.claude_used ? "success" : "muted"} className="text-[10px]">
                {preview.claude_used ? (
                  <>
                    <Sparkles className="h-3 w-3" /> Claude mapped
                    {preview.claude_confidence !== undefined && (
                      <> · {(preview.claude_confidence * 100).toFixed(0)}% conf</>
                    )}
                  </>
                ) : (
                  "Basic column mapping"
                )}
              </Badge>
            </div>
          </div>

          <div className="rounded-md border bg-stone-50/40 p-3 text-xs">
            <div className="mb-1.5 font-medium text-stone-700">Detected column mapping</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(preview.column_mapping).map(([field, header]) => (
                <span
                  key={field}
                  className="rounded-full border border-stone-200 bg-white px-2 py-0.5"
                >
                  <span className="text-muted-foreground">
                    {IMPORT_FIELD_LABEL[field as keyof typeof IMPORT_FIELD_LABEL] ?? field}
                  </span>
                  <span className="text-stone-300"> → </span>
                  <span className="font-medium">{header}</span>
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview table */}
      <Card>
        <CardContent className="space-y-3 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-xl">Preview & edit</h3>
              <p className="text-xs text-muted-foreground">
                Edit any cell before committing. Trash icon removes that row from the import.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-500">Default side for blanks:</span>
              <Select
                value={defaultSide}
                onValueChange={(v) => setDefaultSide(v as typeof defaultSide)}
              >
                <SelectTrigger className="h-8 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">— unset —</SelectItem>
                  {GUEST_SIDES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SIDE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-[0.15em] text-stone-500">
                <tr>
                  <th className="px-2 py-2 text-left">Name</th>
                  <th className="px-2 py-2 text-left">Side</th>
                  <th className="px-2 py-2 text-left">Email</th>
                  <th className="px-2 py-2 text-left">Phone</th>
                  <th className="px-2 py-2 text-left">Relationship</th>
                  <th className="px-2 py-2 text-left">Address</th>
                  <th className="px-2 py-2 text-left">Dietary</th>
                  <th className="px-2 py-2 text-left">Warnings</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => (
                  <tr key={i} className="border-t border-stone-100">
                    <td className="px-2 py-1.5">
                      <Input
                        className="h-7 min-w-[140px] text-xs"
                        value={r.full_name ?? ""}
                        onChange={(e) => updateRow(i, { full_name: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Select
                        value={r.side ?? "unset"}
                        onValueChange={(v) =>
                          updateRow(i, {
                            side: v === "unset" ? null : (v as GuestSide),
                          })
                        }
                      >
                        <SelectTrigger className="h-7 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unset">—</SelectItem>
                          {GUEST_SIDES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {SIDE_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className="h-7 min-w-[140px] text-xs"
                        value={r.email ?? ""}
                        onChange={(e) => updateRow(i, { email: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className="h-7 min-w-[120px] text-xs"
                        value={r.phone ?? ""}
                        onChange={(e) => updateRow(i, { phone: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className="h-7 min-w-[100px] text-xs"
                        value={r.relationship ?? ""}
                        onChange={(e) => updateRow(i, { relationship: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className="h-7 min-w-[140px] text-xs"
                        value={r.address ?? ""}
                        onChange={(e) => updateRow(i, { address: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className="h-7 min-w-[100px] text-xs"
                        value={r.dietary ?? ""}
                        onChange={(e) => updateRow(i, { dietary: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-amber-700">
                      {r.warnings && r.warnings.length > 0
                        ? r.warnings.join(", ")
                        : ""}
                    </td>
                    <td className="px-2 py-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRow(i)}
                        aria-label="Skip row"
                      >
                        ×
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-stone-200 bg-white/90 p-4 backdrop-blur">
        <p className="text-sm text-muted-foreground">
          Ready to import <span className="font-medium text-foreground">{validRows.length}</span>{" "}
          guest{validRows.length === 1 ? "" : "s"}.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStage("drop")}>
            Cancel
          </Button>
          <Button onClick={commit} disabled={validRows.length === 0 || stage === "committing"}>
            {stage === "committing" ? "Committing…" : `Commit ${validRows.length} guests`}
          </Button>
        </div>
      </div>
    </div>
  );
}
