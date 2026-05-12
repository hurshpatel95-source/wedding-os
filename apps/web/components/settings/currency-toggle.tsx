"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Currency = "USD" | "EUR";

const OPTIONS: Array<{
  value: Currency;
  label: string;
  symbol: string;
  blurb: string;
}> = [
  {
    value: "USD",
    label: "US Dollars",
    symbol: "$",
    blurb: "Default for US weddings (Philadelphia, Charleston, Austin, anywhere stateside).",
  },
  {
    value: "EUR",
    label: "Euros",
    symbol: "€",
    blurb: "European venues (Barcelona, Paris, Tuscany, Lisbon, etc.).",
  },
];

export function CurrencyToggle({
  initialCurrency,
}: {
  initialCurrency: string;
}) {
  const router = useRouter();
  const start: Currency =
    initialCurrency?.toUpperCase() === "EUR" ? "EUR" : "USD";
  const [selected, setSelected] = useState<Currency>(start);
  const [saving, setSaving] = useState<Currency | null>(null);

  async function handlePick(c: Currency) {
    if (c === selected || saving != null) return;
    setSaving(c);
    try {
      const res = await fetch("/api/workspace/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base_currency: c }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error ?? "Couldn't change currency.");
        return;
      }
      setSelected(c);
      toast.success(
        `Currency switched to ${c}. Refreshing pages will pick it up.`,
      );
      router.refresh();
    } catch (err) {
      toast.error(`Network error: ${(err as Error).message}`);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {OPTIONS.map((o) => {
        const active = selected === o.value;
        const isSaving = saving === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => handlePick(o.value)}
            disabled={saving != null}
            className={cn(
              "group relative flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all",
              active
                ? "border-stone-900 bg-stone-50 shadow-sm"
                : "border-stone-200 bg-white hover:border-stone-400",
              saving != null && !active && "opacity-50",
            )}
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full font-serif text-2xl font-light",
                    active
                      ? "bg-stone-900 text-white"
                      : "bg-stone-100 text-stone-500 group-hover:bg-stone-200",
                  )}
                >
                  {o.symbol}
                </div>
                <div>
                  <div className="font-serif text-lg font-medium leading-tight">
                    {o.label}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-stone-500">
                    {o.value}
                  </div>
                </div>
              </div>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin text-stone-500" />
              ) : active ? (
                <Check className="h-4 w-4 text-stone-900" />
              ) : null}
            </div>
            <p className="text-xs text-stone-600">{o.blurb}</p>
          </button>
        );
      })}
    </div>
  );
}
