"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export function ScorecardForm({ initialUrl }: { initialUrl: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!url) {
      toast.error("Drop your website URL first");
      return;
    }
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    setBusy(true);
    const t = toast.loading("Fetching site + asking Claude…");
    try {
      const res = await fetch("/api/admin/marketing/scorecard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: normalized }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not run scorecard");
      toast.dismiss(t);
      toast.success("Scorecard ready");
      router.refresh();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Could not run scorecard");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <label className="block text-[10px] uppercase tracking-[0.2em] text-stone-500">
            Your website URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourstudio.com"
            className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {busy ? "Running…" : "Run scorecard"}
        </button>
      </div>
      <p className="mt-3 text-[11px] text-stone-500">
        Pulls the page, parses title + meta + structure, runs Claude to write
        a prioritized fix list. Counts against your daily AI budget — usually
        ~$0.05 per scorecard.
      </p>
    </section>
  );
}
