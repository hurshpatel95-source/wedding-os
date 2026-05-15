"use client";

// Photo → pricing — migrated from /visualize into the Studio framework.
//
// Unlike the generative tools, this calls the existing
// /api/visualize/photo-to-pricing multimodal endpoint and renders a
// structured pricing analysis (price range + identified vendor items
// + inspiration terms). No image generation, no Higgsfield.
//
// Day 3.5 cleanup (deferred): fold this endpoint into the generic
// studio generate path so the registry's clarify+generate flow can
// own it. For now the standalone endpoint stays — less to change,
// smoke tests stay aligned.

import { useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { VENDOR_CATEGORY_LABEL } from "@/lib/vendor-categories";
import type { VendorCategory } from "@/lib/vendor-types";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ACCEPTED_LABEL = "JPEG, PNG, WEBP, or GIF (≤ 5 MB)";

interface PricingAnalysisItem {
  category: VendorCategory;
  description: string;
  confidence: "high" | "medium" | "low";
}

interface PricingAnalysis {
  image_summary: string;
  wedding_relevant: boolean;
  identified_items: PricingAnalysisItem[];
  suggested_vendor_categories: VendorCategory[];
  typical_price_range: {
    low_usd: number;
    mid_usd: number;
    high_usd: number;
    notes: string;
  };
  similar_inspiration_terms: string[];
}

interface AnalyzeResponse {
  analysis: PricingAnalysis;
  workspace: {
    base_currency: "USD" | "EUR";
    wedding_region: string | null;
    guest_count_estimate: number | null;
  };
}

type Stage = "idle" | "analyzing" | "result" | "error";

export function PricingAnalyzerStudio({
  baseCurrency,
  weddingRegion,
}: {
  baseCurrency: "USD" | "EUR";
  weddingRegion: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setStage("idle");
    setFile(null);
    setPreviewUrl(null);
    setNotes("");
    setError(null);
    setResult(null);
  };

  const acceptFile = (f: File | null) => {
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError(`That file type isn't supported. Use ${ACCEPTED_LABEL}.`);
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      setError(
        `Image is too large (${(f.size / 1024 / 1024).toFixed(
          1,
        )} MB). Max 5 MB.`,
      );
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setError(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  };

  const analyze = async () => {
    if (!file) return;
    setStage("analyzing");
    setError(null);
    const fd = new FormData();
    fd.append("image", file);
    if (notes.trim()) fd.append("notes", notes.trim());
    try {
      const res = await fetch("/api/visualize/photo-to-pricing", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Analysis failed (${res.status})`);
      }
      const data = (await res.json()) as AnalyzeResponse;
      setResult(data);
      setStage("result");
    } catch (e) {
      setError((e as Error).message);
      setStage("error");
    }
  };

  // ── Result view ────────────────────────────────────────────────────
  if (stage === "result" && result) {
    const a = result.analysis;
    const cur = result.workspace.base_currency;
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
          <Card>
            <CardContent className="p-3">
              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Uploaded inspiration"
                  className="max-h-[420px] w-full rounded-lg object-cover"
                />
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                {file?.name}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 py-5">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                  What we saw
                </div>
                <p className="mt-1 text-sm leading-relaxed text-stone-800">
                  {a.image_summary || "No summary returned."}
                </p>
              </div>

              {a.wedding_relevant ? (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                    Estimated price range
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(
                      [
                        { label: "Low", val: a.typical_price_range.low_usd },
                        { label: "Mid", val: a.typical_price_range.mid_usd },
                        { label: "High", val: a.typical_price_range.high_usd },
                      ] as const
                    ).map((cell) => (
                      <div
                        key={cell.label}
                        className="rounded-lg border border-stone-200 bg-stone-50/60 p-3 text-center"
                      >
                        <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
                          {cell.label}
                        </div>
                        <div className="mt-1 font-serif text-lg">
                          {formatCurrency(cell.val, cur)}
                        </div>
                      </div>
                    ))}
                  </div>
                  {a.typical_price_range.notes && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {a.typical_price_range.notes}
                    </p>
                  )}
                  {weddingRegion && (
                    <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-stone-400">
                      Region: {weddingRegion}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
                  This image doesn&apos;t look wedding-relevant, so we
                  can&apos;t price it. Try a photo of a setup, installation,
                  cake, dress, or table setting.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {a.identified_items.length > 0 && (
          <Card>
            <CardContent className="space-y-3 py-5">
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                Identified elements
              </div>
              <ul className="space-y-2">
                {a.identified_items.map((it, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-md border border-stone-200 p-3"
                  >
                    <Badge variant="muted" className="text-[10px]">
                      {VENDOR_CATEGORY_LABEL[it.category] ?? it.category}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-stone-800">{it.description}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-stone-400">
                        Confidence: {it.confidence}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {a.suggested_vendor_categories.length > 0 && (
          <Card>
            <CardContent className="space-y-3 py-5">
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                Find local vendors
              </div>
              <div className="flex flex-wrap gap-2">
                {a.suggested_vendor_categories.map((cat) => (
                  <Link
                    key={cat}
                    href={`/vendors/find?category=${encodeURIComponent(cat)}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-900 transition hover:bg-rose-100"
                  >
                    {VENDOR_CATEGORY_LABEL[cat] ?? cat}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {a.similar_inspiration_terms.length > 0 && (
          <Card>
            <CardContent className="space-y-3 py-5">
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                Similar inspiration to search
              </div>
              <div className="flex flex-wrap gap-2">
                {a.similar_inspiration_terms.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-700"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={reset}>
            <RefreshCw className="h-3.5 w-3.5" /> Analyze another
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <Card className="border-destructive/40">
        <CardContent className="space-y-3 py-8">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-serif text-xl">Analysis failed</h3>
          </div>
          <p className="text-sm">{error}</p>
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const analyzing = stage === "analyzing";
  return (
    <Card>
      <CardContent className="space-y-4 py-8">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!analyzing) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            if (analyzing) return;
            onDrop(e);
          }}
          className={cn(
            "rounded-2xl border-2 border-dashed p-10 text-center transition-colors",
            dragOver
              ? "border-foreground/40 bg-secondary/40"
              : "border-stone-300 bg-stone-50/50",
          )}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Selected"
              className="mx-auto max-h-72 rounded-lg object-contain shadow-sm"
            />
          ) : (
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              {analyzing ? (
                <Sparkles className="h-6 w-6 animate-pulse" />
              ) : (
                <Camera className="h-6 w-6" />
              )}
            </div>
          )}

          <h3 className="mt-4 font-serif text-2xl">
            {analyzing
              ? "Analyzing…"
              : previewUrl
                ? "Ready to analyze"
                : "Drop an inspiration photo"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {analyzing
              ? "AI is reading the image and estimating local pricing. ~10 seconds."
              : `${ACCEPTED_LABEL}.`}
          </p>

          {!analyzing && (
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />{" "}
              {previewUrl ? "Pick a different photo" : "Pick a photo"}
            </Button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
          />

          {error && (
            <div
              role="alert"
              className="mx-auto mt-4 max-w-md rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            >
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
              {error}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="pricing-analyzer-notes"
            className="text-[10px] uppercase tracking-[0.2em] text-stone-500"
          >
            Notes (optional)
          </label>
          <Textarea
            id="pricing-analyzer-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 600))}
            placeholder="e.g. this is for our sangeet decor, mostly white + blush"
            disabled={analyzing}
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            {weddingRegion
              ? `Pricing will use your region (${weddingRegion}) and ${baseCurrency}.`
              : `No region set — pricing will use US national averages in ${baseCurrency}. Set yours in Settings.`}
          </p>
          <Button
            onClick={analyze}
            disabled={!file || analyzing}
            className="min-w-[140px]"
          >
            {analyzing ? (
              <>
                <Sparkles className="h-4 w-4 animate-pulse" /> Analyzing…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Analyze
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
