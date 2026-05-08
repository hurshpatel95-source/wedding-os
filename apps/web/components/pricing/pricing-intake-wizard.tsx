"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  Check,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatMoney } from "@/lib/utils";
import {
  AUTO_APPLY_THRESHOLD,
  type IntakePreview,
  type ProposalDTO,
} from "@/lib/pricing-intake-types";

type Stage = "drop" | "uploading" | "review" | "applying" | "done" | "error";

interface VenueLite {
  id: string;
  name: string;
}

interface DraftRow {
  proposal: ProposalDTO;
  decision: "accepted" | "rejected" | "edited";
  edits: { proposed_unit_price?: number };
  target_venue_id: string | null;
}

export function PricingIntakeWizard({ venues }: { venues: VenueLite[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("drop");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<IntakePreview | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [sourceLabel, setSourceLabel] = useState("");
  const [venueId, setVenueId] = useState<string>("none");
  const [textInput, setTextInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [appliedSummary, setAppliedSummary] = useState<{ applied: number; skipped: number } | null>(null);

  const uploadFile = async (file: File) => {
    setStage("uploading");
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    if (sourceLabel) fd.append("source_label", sourceLabel);
    if (venueId !== "none") fd.append("venue_id", venueId);
    try {
      const res = await fetch("/api/pricing/intake/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Upload failed (${res.status})`);
      }
      const data = (await res.json()) as IntakePreview;
      handlePreview(data);
    } catch (e) {
      setError((e as Error).message);
      setStage("error");
    }
  };

  const uploadText = async () => {
    if (!textInput.trim()) return;
    setStage("uploading");
    setError(null);
    try {
      const res = await fetch("/api/pricing/intake/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: textInput,
          source_label: sourceLabel || undefined,
          venue_id: venueId === "none" ? undefined : venueId,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Upload failed (${res.status})`);
      }
      const data = (await res.json()) as IntakePreview;
      handlePreview(data);
    } catch (e) {
      setError((e as Error).message);
      setStage("error");
    }
  };

  const handlePreview = (data: IntakePreview) => {
    setPreview(data);
    setDrafts(
      data.proposals.map((p) => ({
        proposal: p,
        decision:
          p.confidence >= AUTO_APPLY_THRESHOLD && p.matched_line_item_id && !p.needs_info
            ? "accepted"
            : "accepted",
        edits: {},
        target_venue_id: venueId === "none" ? null : venueId,
      })),
    );
    setStage("review");
  };

  const updateDraft = (i: number, patch: Partial<DraftRow>) => {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };

  const apply = async () => {
    if (!preview) return;
    setStage("applying");
    setError(null);
    try {
      const res = await fetch("/api/pricing/intake/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source_id: preview.source_id,
          decisions: drafts.map((d) => ({
            proposal_id: d.proposal.id,
            decision: d.decision,
            edits: d.edits,
            target_venue_id: d.target_venue_id,
          })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Apply failed (${res.status})`);
      }
      const data = (await res.json()) as { applied: number; skipped: number; errors: string[] };
      setAppliedSummary({ applied: data.applied, skipped: data.skipped });
      setStage("done");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setStage("error");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) uploadFile(f);
  };

  // STAGE: drop / uploading
  if (stage === "drop" || stage === "uploading") {
    return (
      <div className="space-y-3">
        <Card>
          <CardContent className="space-y-4 py-6">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="lbl">Source label (optional)</Label>
                <Input
                  id="lbl"
                  placeholder="Planner WhatsApp 5/6, Email re: vendor pricing, etc."
                  value={sourceLabel}
                  onChange={(e) => setSourceLabel(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Venue context (for venue-specific overrides)</Label>
                <Select value={venueId} onValueChange={setVenueId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— template-wide defaults —</SelectItem>
                    {venues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

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
                {stage === "uploading" ? "Reading your source…" : "Drop a screenshot or PDF"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {stage === "uploading"
                  ? "Claude is extracting prices and matching to your line items. ~10-30 seconds."
                  : "Image (.png/.jpg/.heic), PDF (.pdf). We show every proposed change before anything saves."}
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
                accept="image/*,application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f);
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Or paste text */}
        <Card>
          <CardContent className="space-y-3 py-5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-stone-500" />
              <Label className="font-serif text-base">Or paste text</Label>
            </div>
            <Textarea
              rows={6}
              placeholder='"Wedding 220 euros, sangeet 180 euros — drinks service tableware furniture all included"'
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={stage === "uploading"}
            />
            <Button
              type="button"
              onClick={uploadText}
              disabled={stage === "uploading" || !textInput.trim()}
            >
              <Sparkles className="h-4 w-4" /> Extract from text
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <Card className="border-destructive/40">
        <CardContent className="space-y-3 py-8">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-serif text-xl">Intake failed</h3>
          </div>
          <p className="text-sm">{error}</p>
          <Button type="button" variant="outline" onClick={() => setStage("drop")}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (stage === "done" && appliedSummary) {
    return (
      <Card className="border-emerald-300/60">
        <CardContent className="space-y-3 py-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="h-6 w-6" />
          </div>
          <h3 className="font-serif text-2xl">
            Applied {appliedSummary.applied} change{appliedSummary.applied === 1 ? "" : "s"}
          </h3>
          {appliedSummary.skipped > 0 && (
            <p className="text-sm text-muted-foreground">
              {appliedSummary.skipped} rejected/skipped.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Pricing in /pricing now reflects these changes. Audit log on every line.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Button onClick={() => router.push("/pricing")}>Open scenario builder</Button>
            <Button
              variant="outline"
              onClick={() => {
                setPreview(null);
                setDrafts([]);
                setAppliedSummary(null);
                setStage("drop");
              }}
            >
              Run another intake
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!preview) return null;

  // STAGE: review
  const accepted = drafts.filter((d) => d.decision !== "rejected").length;
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-1 py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-serif text-xl">{preview.source_label ?? "Untitled source"}</h3>
              <p className="text-xs text-muted-foreground">
                Claude extracted {preview.proposals.length} proposal
                {preview.proposals.length === 1 ? "" : "s"} · cost{" "}
                {formatMoney(preview.cost_usd ?? 0, "USD")}
              </p>
            </div>
            <Badge variant="success" className="text-[10px]">
              <Sparkles className="h-3 w-3" /> Sonnet 4.6 extracted
            </Badge>
          </div>
          {preview.warning && (
            <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {preview.warning}
            </p>
          )}
        </CardContent>
      </Card>

      {drafts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No proposals to review. Try a different source.
          </CardContent>
        </Card>
      ) : (
        drafts.map((d, i) => (
          <Card key={i} className={cn(d.decision === "rejected" && "opacity-60")}>
            <CardContent className="space-y-3 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        d.proposal.kind === "new_line_item"
                          ? "warning"
                          : d.proposal.kind === "default_price"
                          ? "default"
                          : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {d.proposal.kind.replace("_", " ")}
                    </Badge>
                    <span className="font-medium">
                      {d.proposal.proposed_label ??
                        (d.proposal.matched_line_item_id ? "Existing line item" : "Unnamed")}
                    </span>
                    {d.proposal.confidence >= AUTO_APPLY_THRESHOLD && (
                      <Badge variant="success" className="text-[10px]">
                        High confidence
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs italic text-muted-foreground">
                    "{d.proposal.evidence?.quote}"
                  </p>
                  <p className="mt-1 text-xs text-stone-500">{d.proposal.rationale}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="muted" className="text-[10px]">
                    {Math.round(d.proposal.confidence * 100)}% conf
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label>Unit price (€)</Label>
                  <Input
                    inputMode="decimal"
                    value={d.edits.proposed_unit_price ?? d.proposal.proposed_unit_price ?? ""}
                    onChange={(e) =>
                      updateDraft(i, {
                        edits: {
                          ...d.edits,
                          proposed_unit_price: Number(
                            e.target.value.replace(/[^\d.]/g, "") || 0,
                          ),
                        },
                      })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Unit</Label>
                  <Input
                    value={d.proposal.proposed_unit ?? "—"}
                    disabled
                    className="bg-stone-50"
                  />
                </div>
                {d.proposal.kind === "override" && (
                  <div className="grid gap-1.5">
                    <Label>Apply to venue</Label>
                    <Select
                      value={d.target_venue_id ?? "none"}
                      onValueChange={(v) =>
                        updateDraft(i, { target_venue_id: v === "none" ? null : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— pick a venue —</SelectItem>
                        {venues.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {d.proposal.needs_info && (
                <div className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <strong>Claude wants clarification:</strong> {d.proposal.needs_info}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={d.decision === "accepted" ? "default" : "outline"}
                  onClick={() => updateDraft(i, { decision: "accepted" })}
                >
                  Accept
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={d.decision === "rejected" ? "destructive" : "outline"}
                  onClick={() => updateDraft(i, { decision: "rejected" })}
                >
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-stone-200 bg-white/90 p-4 backdrop-blur">
        <p className="text-sm text-muted-foreground">
          Ready to apply <span className="font-medium text-foreground">{accepted}</span> change
          {accepted === 1 ? "" : "s"}.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStage("drop")}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={accepted === 0 || stage === "applying"}>
            {stage === "applying" ? "Applying…" : `Apply ${accepted} change${accepted === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
