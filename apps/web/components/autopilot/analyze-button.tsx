"use client";

// Small button that POSTs to /api/autopilot/analyze-thread for a single
// vendor. Shows a loading spinner, toast on success/error, and refreshes
// the page so the new vendors.autopilot_status / ai_summary / quote_eur
// land. Other agents mount this on their pages — we don't modify the
// vendors detail page here.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface Props {
  vendorId: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg";
  label?: string;
}

interface AnalyzeResponse {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  status?: string;
  quote_eur?: number | null;
  /** Workspace's display currency, used to format quote_eur correctly. */
  base_currency?: string | null;
  alerts_created?: number;
  ai_summary?: string;
  error?: string;
}

export function AnalyzeWithAiButton({
  vendorId,
  variant = "outline",
  size = "default",
  label = "Analyze with AI",
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/autopilot/analyze-thread", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vendor_id: vendorId }),
      });
      const json = (await res.json().catch(() => ({}))) as AnalyzeResponse;

      if (!res.ok) {
        toast.error(json.error ?? "Could not analyze thread");
        return;
      }
      if (json.skipped) {
        toast.message("Nothing to analyze yet", {
          description: json.reason ?? "Waiting on a vendor reply.",
        });
        return;
      }

      const summary = json.ai_summary?.trim();
      // quote_eur column is named for legacy reasons; the value is in
      // workspaces.base_currency. Use the right symbol per workspace.
      const quote =
        typeof json.quote_eur === "number"
          ? formatCurrency(json.quote_eur, json.base_currency)
          : null;
      toast.success(`Status: ${json.status ?? "updated"}`, {
        description: [quote, summary].filter(Boolean).join(" — ") || undefined,
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not analyze");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={busy}
      type="button"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {label}
    </Button>
  );
}

export default AnalyzeWithAiButton;
