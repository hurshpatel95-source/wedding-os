// Pure read-only display for the autopilot fields on a vendor.
//
// Renders:
//   - autopilot_status as a colored pill ("Quoted", "Booked", etc.)
//   - quote_eur + quote_summary as a callout when present
//   - ai_summary as a muted paragraph
//
// Reusable on /vendors/[id], the upcoming /autopilot dashboard, vendor
// search results, and email thread headers. Server-component-friendly —
// no client hooks.

import {
  VENDOR_AUTOPILOT_LABEL,
  type VendorAutopilotStatus,
} from "@/lib/autopilot-types";
import { formatCurrency } from "@/lib/utils";

interface Props {
  status: VendorAutopilotStatus | null | undefined;
  quote_eur?: number | null;
  quote_summary?: string | null;
  ai_summary?: string | null;
  last_inbound_at?: string | null;
  last_outbound_at?: string | null;
  /**
   * Workspace's display currency (workspaces.base_currency). The "_eur"
   * suffix on quote_eur is legacy — the actual value is in this currency.
   * Falls back to USD when unspecified to match the US-default elsewhere.
   */
  base_currency?: string | null;
  compact?: boolean;
}

const PILL_CLASSES: Record<VendorAutopilotStatus, string> = {
  none: "bg-stone-100 text-stone-700 ring-stone-200",
  researching: "bg-sky-50 text-sky-800 ring-sky-200",
  contacted: "bg-violet-50 text-violet-800 ring-violet-200",
  quoted: "bg-amber-50 text-amber-900 ring-amber-200",
  booked: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  declined: "bg-stone-100 text-stone-600 ring-stone-200",
  unavailable: "bg-rose-50 text-rose-800 ring-rose-200",
};

export function VendorStatusDisplay({
  status,
  quote_eur,
  quote_summary,
  ai_summary,
  last_inbound_at,
  last_outbound_at,
  base_currency,
  compact = false,
}: Props) {
  const effective: VendorAutopilotStatus = status ?? "none";
  const label = VENDOR_AUTOPILOT_LABEL[effective];
  const cls = PILL_CLASSES[effective];

  if (compact) {
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ring-1 ring-inset ${cls}`}
      >
        {label}
      </span>
    );
  }

  // Currency-aware quote formatting. The column is named quote_eur for
  // legacy reasons but the stored value is in workspaces.base_currency
  // (USD for US couples, EUR for European). Fall back to USD when the
  // caller didn't pass a currency.
  const formattedQuote =
    typeof quote_eur === "number" && Number.isFinite(quote_eur)
      ? formatCurrency(quote_eur, base_currency)
      : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ring-1 ring-inset ${cls}`}
        >
          {label}
        </span>
        {last_inbound_at ? (
          <span className="text-[11px] text-stone-500">
            Last reply: {formatRelative(last_inbound_at)}
          </span>
        ) : last_outbound_at ? (
          <span className="text-[11px] text-stone-500">
            Sent: {formatRelative(last_outbound_at)}
          </span>
        ) : null}
      </div>

      {formattedQuote && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-900/70">
            Quote
          </div>
          <div className="font-serif text-lg text-amber-900">
            {formattedQuote}
          </div>
          {quote_summary && (
            <div className="mt-0.5 text-xs text-amber-900/80">
              {quote_summary}
            </div>
          )}
        </div>
      )}

      {ai_summary && (
        <p className="text-sm leading-relaxed text-stone-600">{ai_summary}</p>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return iso;
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

export default VendorStatusDisplay;
