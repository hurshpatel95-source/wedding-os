"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  NewClientRequest,
  NewClientResponse,
} from "@/lib/admin-onboarding-types";

interface VenueOpt {
  id: string;
  name: string;
  city: string | null;
}
interface VendorOpt {
  id: string;
  name: string;
  category: string;
}

interface PushResult {
  kind: "venue" | "vendor";
  name: string;
  ok: boolean;
  message?: string;
}

export function NewClientForm({
  libraryVenues,
  libraryVendors,
}: {
  libraryVenues: VenueOpt[];
  libraryVendors: VendorOpt[];
}) {
  const router = useRouter();
  const [coupleEmail, setCoupleEmail] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [applyPlaybook, setApplyPlaybook] = useState(true);
  const [pickedVenues, setPickedVenues] = useState<Set<string>>(new Set());
  const [pickedVendors, setPickedVendors] = useState<Set<string>>(new Set());

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NewClientResponse | null>(null);
  const [pushResults, setPushResults] = useState<PushResult[]>([]);
  const [copied, setCopied] = useState(false);

  const toggle = (s: Set<string>, id: string): Set<string> => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setPushResults([]);
    setSubmitting(true);

    const body: NewClientRequest = {
      couple_email: coupleEmail.trim(),
      workspace_name: workspaceName.trim(),
      wedding_date: weddingDate || null,
      apply_playbook: applyPlaybook,
    };

    try {
      const res = await fetch("/api/admin/clients/new", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as
        | NewClientResponse
        | { error: string };
      if (!res.ok || "error" in data) {
        setError(("error" in data && data.error) || "Failed to create client.");
        setSubmitting(false);
        return;
      }
      const created = data as NewClientResponse;
      setResult(created);

      // Now push library items in sequence (parallel would race against
      // RLS) — collect per-item results so the planner can see what
      // landed and what failed.
      const newWorkspaceId = created.workspace_id;
      const results: PushResult[] = [];
      for (const id of pickedVenues) {
        const v = libraryVenues.find((x) => x.id === id);
        try {
          const r = await fetch("/api/admin/push/library-venue", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              library_venue_id: id,
              workspace_id: newWorkspaceId,
            }),
          });
          const j = await r.json();
          results.push({
            kind: "venue",
            name: v?.name ?? id,
            ok: r.ok,
            message: r.ok ? undefined : j.error,
          });
        } catch (e) {
          results.push({
            kind: "venue",
            name: v?.name ?? id,
            ok: false,
            message: (e as Error).message,
          });
        }
      }
      for (const id of pickedVendors) {
        const v = libraryVendors.find((x) => x.id === id);
        try {
          const r = await fetch("/api/admin/push/library-vendor", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              library_vendor_id: id,
              workspace_id: newWorkspaceId,
            }),
          });
          const j = await r.json();
          results.push({
            kind: "vendor",
            name: v?.name ?? id,
            ok: r.ok,
            message: r.ok ? undefined : j.error,
          });
        } catch (e) {
          results.push({
            kind: "vendor",
            name: v?.name ?? id,
            ok: false,
            message: (e as Error).message,
          });
        }
      }
      setPushResults(results);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const copyMagicLink = async () => {
    if (!result?.magic_link) return;
    await navigator.clipboard.writeText(result.magic_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (result) {
    const failed = pushResults.filter((r) => !r.ok).length;
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Workspace created. Share the magic link below with the couple.
        </div>

        {result.magic_link ? (
          <div className="space-y-2">
            <Label>Magic link</Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={result.magic_link}
                onClick={(e) => e.currentTarget.select()}
              />
              <Button type="button" variant="outline" onClick={copyMagicLink}>
                <Copy className="h-4 w-4" />
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Workspace created, but magic-link generation failed. Re-invite
            from Supabase auth.
          </div>
        )}

        {pushResults.length > 0 && (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Library push · {pushResults.length} items ·{" "}
              {failed > 0 ? `${failed} failed` : "all good"}
            </div>
            <ul className="space-y-0.5 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs">
              {pushResults.map((r, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-center justify-between gap-2",
                    r.ok ? "text-stone-700" : "text-rose-700",
                  )}
                >
                  <span>
                    {r.ok ? "✓" : "✗"} {r.kind}: {r.name}
                  </span>
                  {!r.ok && (
                    <span className="text-[10px] opacity-80">{r.message}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.warnings.length > 0 && (
          <ul className="space-y-1 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
            {result.warnings.map((w, i) => (
              <li key={i}>· {w}</li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setResult(null);
              setCoupleEmail("");
              setWorkspaceName("");
              setWeddingDate("");
              setPickedVenues(new Set());
              setPickedVendors(new Set());
              setPushResults([]);
            }}
          >
            Add another
          </Button>
          <Button type="button" onClick={() => router.push("/admin/clients")}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="couple_email">Couple email</Label>
          <Input
            id="couple_email"
            type="email"
            required
            placeholder="couple@example.com"
            value={coupleEmail}
            onChange={(e) => setCoupleEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="workspace_name">Workspace name</Label>
          <Input
            id="workspace_name"
            required
            placeholder="Anna & Pete — Italy 2026"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2 md:max-w-xs">
        <Label htmlFor="wedding_date">Wedding date (optional)</Label>
        <Input
          id="wedding_date"
          type="date"
          value={weddingDate}
          onChange={(e) => setWeddingDate(e.target.value)}
        />
      </div>

      <label className="flex items-start gap-3 rounded-md border border-stone-200 bg-stone-50/60 p-3">
        <input
          type="checkbox"
          checked={applyPlaybook}
          onChange={(e) => setApplyPlaybook(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-stone-300"
        />
        <span className="text-sm">
          <span className="font-medium">
            Apply default playbook to this client
          </span>
          <span className="block text-xs text-stone-500">
            Copies your studio&rsquo;s playbook phases + tasks into the new
            workspace as planning tasks.
          </span>
        </span>
      </label>

      {libraryVenues.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
            Library venues to push ({pickedVenues.size} selected)
          </div>
          <div className="grid gap-1.5 rounded-md border border-stone-200 bg-stone-50/60 p-3 sm:grid-cols-2">
            {libraryVenues.map((v) => (
              <label
                key={v.id}
                className={cn(
                  "flex items-center gap-2 rounded-md border bg-white px-2 py-1.5 text-sm transition cursor-pointer",
                  pickedVenues.has(v.id)
                    ? "border-rose-400 ring-2 ring-rose-100"
                    : "border-stone-200 hover:border-stone-400",
                )}
              >
                <input
                  type="checkbox"
                  checked={pickedVenues.has(v.id)}
                  onChange={() => setPickedVenues((s) => toggle(s, v.id))}
                  className="h-3.5 w-3.5"
                />
                <span className="flex-1">{v.name}</span>
                {v.city && (
                  <span className="text-[10px] text-stone-500">{v.city}</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {libraryVendors.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
            Library vendors to push ({pickedVendors.size} selected)
          </div>
          <div className="grid gap-1.5 rounded-md border border-stone-200 bg-stone-50/60 p-3 sm:grid-cols-2">
            {libraryVendors.map((v) => (
              <label
                key={v.id}
                className={cn(
                  "flex items-center gap-2 rounded-md border bg-white px-2 py-1.5 text-sm transition cursor-pointer",
                  pickedVendors.has(v.id)
                    ? "border-rose-400 ring-2 ring-rose-100"
                    : "border-stone-200 hover:border-stone-400",
                )}
              >
                <input
                  type="checkbox"
                  checked={pickedVendors.has(v.id)}
                  onChange={() => setPickedVendors((s) => toggle(s, v.id))}
                  className="h-3.5 w-3.5"
                />
                <span className="flex-1">{v.name}</span>
                <span className="text-[10px] text-stone-500">
                  {v.category.replace(/_/g, " ")}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Create workspace
          {(pickedVenues.size > 0 || pickedVendors.size > 0) &&
            ` + push ${pickedVenues.size + pickedVendors.size}`}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/admin/clients")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
