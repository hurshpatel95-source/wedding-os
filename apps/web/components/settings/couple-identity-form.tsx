"use client";

// Couple identity card. partner_a_name + partner_b_name compose into the
// workspace.name as `${a} & ${b}'s wedding`. If only A is filled, we fall
// back to `${a}'s wedding`.
//
// Pre-population: we attempt a best-effort parse of the existing workspace
// name to seed the inputs. If the parse fails, the inputs start empty and
// the saved workspace name is left alone unless the user types something.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ParsedNames {
  a: string;
  b: string;
}

// Parse `${a} & ${b}'s wedding`, or `${a}'s wedding`, or just `${a} & ${b}`.
// Returns empty strings on failure.
function parseWorkspaceName(name: string | null | undefined): ParsedNames {
  if (!name) return { a: "", b: "" };
  const stripped = name.replace(/['’]s\s+wedding\s*$/i, "").trim();
  if (!stripped) return { a: "", b: "" };
  // Split on " & " or " and "
  const parts = stripped.split(/\s+(?:&|and)\s+/i).map((p) => p.trim());
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return { a: parts[0], b: parts[1] };
  }
  if (parts.length === 1 && parts[0]) {
    return { a: parts[0], b: "" };
  }
  return { a: "", b: "" };
}

function composeName(a: string, b: string): string {
  const A = a.trim();
  const B = b.trim();
  if (!A && !B) return "";
  if (!B) return `${A}'s wedding`;
  if (!A) return `${B}'s wedding`;
  return `${A} & ${B}'s wedding`;
}

export function CoupleIdentityForm({
  initialName,
}: {
  initialName: string | null;
}) {
  const router = useRouter();
  const seed = parseWorkspaceName(initialName);
  const [partnerA, setPartnerA] = useState(seed.a);
  const [partnerB, setPartnerB] = useState(seed.b);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const composed = composeName(partnerA, partnerB);
    if (!composed) {
      toast.error("Add at least one partner's name.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/workspace/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: composed }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error ?? "Couldn't save names.");
        return;
      }
      toast.success("Saved.");
      router.refresh();
    } catch (err) {
      toast.error(`Network error: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl border border-stone-200 bg-white p-6"
    >
      <div className="mb-4">
        <h2 className="font-serif text-2xl">Couple identity</h2>
        <p className="mt-1 text-sm text-stone-600">
          Your names show up on the dashboard, public site, and emails to
          vendors. Fix typos here — saving rewrites the workspace title.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="partner_a_name">Partner A</Label>
          <Input
            id="partner_a_name"
            value={partnerA}
            onChange={(e) => setPartnerA(e.target.value)}
            placeholder="e.g. Hursh"
            maxLength={100}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="partner_b_name">Partner B</Label>
          <Input
            id="partner_b_name"
            value={partnerB}
            onChange={(e) => setPartnerB(e.target.value)}
            placeholder="e.g. Nisha (leave blank if solo)"
            maxLength={100}
            autoComplete="off"
          />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-stone-500">
          Will save as: <strong>{composeName(partnerA, partnerB) || "—"}</strong>
        </p>
        <Button type="submit" disabled={saving} className="min-w-[80px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </form>
  );
}
