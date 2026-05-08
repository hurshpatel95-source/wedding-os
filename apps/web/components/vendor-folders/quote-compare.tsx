"use client";

// Side-by-side quote comparison for all vendors in a single category.
// Renders a sticky-header table; "Mark as winner" PATCHes the chosen
// vendor to status='booked' + autopilot_status='booked'. Sibling vendors
// stay where they are — the couple may want to keep runners-up around
// for fallback or final negotiation.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Phone, Trophy } from "lucide-react";
import { toast } from "sonner";
import {
  VENDOR_AUTOPILOT_LABEL,
  type VendorAutopilotStatus,
} from "@/lib/autopilot-types";
import { cn } from "@/lib/utils";

const STATUS_PILL: Record<VendorAutopilotStatus, string> = {
  none: "bg-stone-100 text-stone-700",
  researching: "bg-sky-100 text-sky-800",
  contacted: "bg-amber-100 text-amber-800",
  quoted: "bg-violet-100 text-violet-800",
  booked: "bg-emerald-100 text-emerald-800",
  declined: "bg-stone-100 text-stone-500",
  unavailable: "bg-stone-100 text-stone-500",
};

export interface CompareVendor {
  id: string;
  name: string;
  autopilot_status: VendorAutopilotStatus | null;
  quote_eur: number | null;
  quote_summary: string | null;
  ai_summary: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
}

export interface QuoteCompareProps {
  vendors: CompareVendor[];
  category: string;
}

function formatEur(amount: number | null): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `€${Math.round(amount).toLocaleString()}`;
  }
}

function relativeFromNow(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.round(months / 12);
  return `${years}y ago`;
}

export function QuoteCompare({ vendors: initial, category }: QuoteCompareProps) {
  const router = useRouter();
  const [vendors, setVendors] = useState<CompareVendor[]>(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Sort: lowest priced quote first, then "quoted" status before others, then by name.
  const sorted = useMemo(() => {
    const STATUS_RANK: Record<VendorAutopilotStatus, number> = {
      booked: 0,
      quoted: 1,
      contacted: 2,
      researching: 3,
      none: 4,
      unavailable: 5,
      declined: 6,
    };
    return [...vendors].sort((a, b) => {
      const aq = a.quote_eur ?? Number.POSITIVE_INFINITY;
      const bq = b.quote_eur ?? Number.POSITIVE_INFINITY;
      if (aq !== bq) return aq - bq;
      const ar = STATUS_RANK[a.autopilot_status ?? "none"] ?? 99;
      const br = STATUS_RANK[b.autopilot_status ?? "none"] ?? 99;
      if (ar !== br) return ar - br;
      return a.name.localeCompare(b.name);
    });
  }, [vendors]);

  const lowestQuote = useMemo(() => {
    const quoted = vendors
      .map((v) => v.quote_eur)
      .filter((q): q is number => q != null);
    return quoted.length > 0 ? Math.min(...quoted) : null;
  }, [vendors]);

  const markWinner = async (vendor: CompareVendor) => {
    if (
      !window.confirm(
        `Book ${vendor.name} as your ${category}? You can keep the others as fallback — they won't be removed.`,
      )
    ) {
      return;
    }
    setPendingId(vendor.id);
    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "booked",
          autopilot_status: "booked",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Could not mark as winner");
        return;
      }
      setVendors((prev) =>
        prev.map((v) =>
          v.id === vendor.id ? { ...v, autopilot_status: "booked" } : v,
        ),
      );
      toast.success(`${vendor.name} booked`);
      startTransition(() => {
        router.refresh();
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not mark as winner";
      toast.error(msg);
    } finally {
      setPendingId(null);
    }
  };

  if (vendors.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-8 py-12 text-center text-sm text-stone-500">
        No {category} vendors yet —{" "}
        <Link
          href="/vendors/find"
          className="font-medium text-stone-800 underline-offset-4 hover:underline"
        >
          find some
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-stone-200">
        <thead className="bg-stone-50">
          <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-stone-500">
            <th scope="col" className="px-4 py-3 font-medium">
              Vendor
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-3 font-medium tabular-nums">
              Quote
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              AI summary
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Last reply
            </th>
            <th scope="col" className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {sorted.map((v) => {
            const status: VendorAutopilotStatus = v.autopilot_status ?? "none";
            const isLowest =
              lowestQuote != null && v.quote_eur === lowestQuote;
            const isBooked = status === "booked";
            return (
              <tr
                key={v.id}
                className={cn(
                  "align-top transition",
                  isBooked ? "bg-emerald-50/50" : "hover:bg-stone-50",
                )}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/vendors/${v.id}`}
                    className="text-sm font-medium text-stone-900 hover:underline"
                  >
                    {v.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
                    <Link
                      href={`/vendors/${v.id}#files`}
                      className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-1.5 py-0.5 hover:bg-stone-50"
                    >
                      Files
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                      STATUS_PILL[status],
                    )}
                  >
                    {VENDOR_AUTOPILOT_LABEL[status]}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  <div
                    className={cn(
                      "text-sm font-medium",
                      v.quote_eur == null
                        ? "text-stone-400"
                        : isLowest
                          ? "text-emerald-700"
                          : "text-stone-900",
                    )}
                  >
                    {formatEur(v.quote_eur)}
                  </div>
                  {v.quote_summary && (
                    <div className="mt-0.5 max-w-[14rem] truncate text-[11px] text-stone-500">
                      {v.quote_summary}
                    </div>
                  )}
                </td>
                <td className="max-w-[20rem] px-4 py-3">
                  {v.ai_summary ? (
                    <p className="line-clamp-2 text-[12px] leading-relaxed text-stone-700">
                      {v.ai_summary}
                    </p>
                  ) : (
                    <span className="text-[11px] italic text-stone-400">
                      Awaiting Autopilot summary
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-[12px] text-stone-700">
                  <div>{relativeFromNow(v.last_inbound_at)}</div>
                  {v.last_outbound_at && (
                    <div className="mt-0.5 text-[10px] text-stone-400">
                      Sent {relativeFromNow(v.last_outbound_at)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => markWinner(v)}
                    disabled={pendingId === v.id || isBooked}
                    className={cn(
                      "inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium transition",
                      isBooked
                        ? "cursor-default border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-stone-200 bg-white text-stone-800 hover:bg-stone-50 disabled:opacity-50",
                    )}
                    title={
                      isBooked
                        ? "Already booked"
                        : `Mark ${v.name} as your ${category}`
                    }
                  >
                    {pendingId === v.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trophy className="h-3.5 w-3.5" />
                    )}
                    {isBooked ? "Booked" : "Mark as winner"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* Tiny legend keeps the table self-explanatory. */}
      <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 bg-stone-50 px-4 py-2 text-[10px] text-stone-500">
        <span className="inline-flex items-center gap-1">
          <Mail className="h-3 w-3" /> Quotes shown in EUR
        </span>
        <span className="inline-flex items-center gap-1">
          <Phone className="h-3 w-3" /> Lowest quote highlighted in green
        </span>
      </div>
    </div>
  );
}
