"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_GROUP,
  VENDOR_CATEGORY_LABEL,
  VENDOR_GROUP_ORDER,
} from "@/lib/vendor-categories";
import type { VendorCategory } from "@/lib/vendor-types";
import type { VendorSearchResult } from "@/lib/autopilot-types";
import { ResultCard } from "./result-card";

export interface VendorSearchFormProps {
  defaultRegion?: string | null;
  defaultCategory?: VendorCategory;
}

interface SearchResponse {
  ok?: boolean;
  cached?: boolean;
  cached_at?: string;
  provider?: string;
  results?: VendorSearchResult[];
  cost_usd?: number;
  error?: string;
}

interface AddResponse {
  ok?: boolean;
  inserted?: number;
  vendor_ids?: string[];
  error?: string;
}

function groupCategories() {
  const grouped: Record<string, VendorCategory[]> = {};
  for (const c of VENDOR_CATEGORIES) {
    const g = VENDOR_CATEGORY_GROUP[c];
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(c);
  }
  return grouped;
}

function daysAgo(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function VendorSearchForm({
  defaultRegion,
  defaultCategory,
}: VendorSearchFormProps) {
  const router = useRouter();
  const [category, setCategory] = useState<VendorCategory>(
    defaultCategory ?? "florist",
  );
  const [region, setRegion] = useState(defaultRegion ?? "");
  const [budgetHint, setBudgetHint] = useState("");
  const [extraQuery, setExtraQuery] = useState("");

  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<VendorSearchResult[]>([]);
  const [picks, setPicks] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{
    cached: boolean;
    cachedAt?: string;
    provider?: string;
    cost: number;
  } | null>(null);

  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const grouped = groupCategories();

  function buildQuery(): string {
    const cat = VENDOR_CATEGORY_LABEL[category].toLowerCase();
    const parts = [`wedding ${cat}`];
    if (region.trim()) parts.push(`in ${region.trim()}`);
    if (budgetHint.trim()) parts.push(`(${budgetHint.trim()})`);
    if (extraQuery.trim()) parts.push(extraQuery.trim());
    return parts.join(" ");
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAddError(null);
    setMeta(null);
    if (!region.trim()) {
      setError("Region is required — try 'Newport, RI' or 'Lake Como, Italy'");
      return;
    }
    setSearching(true);
    setResults([]);
    setPicks(new Set());
    try {
      const res = await fetch("/api/vendor-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          region: region.trim(),
          query: extraQuery.trim() ? buildQuery() : undefined,
        }),
      });
      const json = (await res.json()) as SearchResponse;
      if (!res.ok || !json.ok) {
        setError(
          json.error ??
            "We couldn't run that search. Please try again in a moment.",
        );
        return;
      }
      setResults(json.results ?? []);
      setMeta({
        cached: !!json.cached,
        cachedAt: json.cached_at,
        provider: json.provider,
        cost: json.cost_usd ?? 0,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Network error — please retry.",
      );
    } finally {
      setSearching(false);
    }
  }

  function togglePick(i: number) {
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function selectAll() {
    setPicks(new Set(results.map((_, i) => i)));
  }

  function selectNone() {
    setPicks(new Set());
  }

  async function handleAdd() {
    setAddError(null);
    if (picks.size === 0) return;
    setAdding(true);
    try {
      const selected = Array.from(picks)
        .sort((a, b) => a - b)
        .map((i) => results[i])
        .filter(Boolean);
      const res = await fetch("/api/vendor-search/add-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picks: selected, category }),
      });
      const json = (await res.json()) as AddResponse;
      if (!res.ok || !json.ok) {
        setAddError(json.error ?? "Couldn't add those vendors.");
        return;
      }
      // Success — bounce back to /vendors
      router.push("/vendors");
      router.refresh();
    } catch (err) {
      setAddError(
        err instanceof Error ? err.message : "Network error — please retry.",
      );
    } finally {
      setAdding(false);
    }
  }

  const friendlyCategory = VENDOR_CATEGORY_LABEL[category].toLowerCase();

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSearch}
        className="space-y-4 rounded-lg border bg-card p-5 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="vs-category">What are you looking for?</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as VendorCategory)}
            >
              <SelectTrigger id="vs-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VENDOR_GROUP_ORDER.map((group) => {
                  const items = grouped[group];
                  if (!items || items.length === 0) return null;
                  return (
                    <SelectGroup key={group}>
                      <SelectLabel>{group}</SelectLabel>
                      {items.map((c) => (
                        <SelectItem key={c} value={c}>
                          {VENDOR_CATEGORY_LABEL[c]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vs-region">Region</Label>
            <Input
              id="vs-region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. Newport, RI or Lake Como, Italy"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vs-budget">Budget hint (optional)</Label>
            <Input
              id="vs-budget"
              value={budgetHint}
              onChange={(e) => setBudgetHint(e.target.value)}
              placeholder="e.g. mid-range, under $5k"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vs-extra">
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Anything specific? (optional)
              </span>
            </Label>
            <Input
              id="vs-extra"
              value={extraQuery}
              onChange={(e) => setExtraQuery(e.target.value)}
              placeholder="e.g. South Asian, garden style, dog-friendly"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={searching}>
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </Button>
          {searching ? (
            <span className="text-xs text-muted-foreground">
              Searching the web for {friendlyCategory}
              {region.trim() ? ` in ${region.trim()}` : ""}…
            </span>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        ) : null}
      </form>

      {meta && results.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {meta.cached ? (
              <>
                Showing cached results
                {meta.cachedAt
                  ? ` from ${daysAgo(meta.cachedAt)} day${
                      daysAgo(meta.cachedAt) === 1 ? "" : "s"
                    } ago`
                  : ""}
                {" — refresh in a week."}
              </>
            ) : (
              <>
                {results.length} fresh result
                {results.length === 1 ? "" : "s"}
                {meta.provider === "brave" ? " (web search fallback)" : ""}
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={selectAll}
              className="text-stone-700 underline-offset-2 hover:underline"
            >
              Select all
            </button>
            <span className="text-stone-300">·</span>
            <button
              type="button"
              onClick={selectNone}
              className="text-stone-700 underline-offset-2 hover:underline"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {results.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r, i) => (
              <ResultCard
                key={`${r.place_id ?? r.website ?? r.name}-${i}`}
                result={r}
                selected={picks.has(i)}
                onToggle={() => togglePick(i)}
              />
            ))}
          </div>

          <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white/95 p-4 shadow-lg backdrop-blur">
            <div className="text-sm">
              {picks.size === 0 ? (
                <span className="text-muted-foreground">
                  Pick the ones you want to track.
                </span>
              ) : (
                <span className="font-medium">
                  {picks.size} selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {addError ? (
                <span className="text-xs text-rose-700">{addError}</span>
              ) : null}
              <Button
                type="button"
                onClick={handleAdd}
                disabled={picks.size === 0 || adding}
              >
                {adding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Add selected ({picks.size})
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
