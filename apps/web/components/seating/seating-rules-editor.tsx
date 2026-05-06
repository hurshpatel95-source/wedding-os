"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GuestLite {
  id: string;
  full_name: string;
}

interface Props {
  guestId: string;
  guestName: string;
  allGuests: GuestLite[];
  initialCantSitWith: string[];
  initialMustSitWith: string[];
}

export function SeatingRulesEditor({
  guestId,
  guestName,
  allGuests,
  initialCantSitWith,
  initialMustSitWith,
}: Props) {
  const router = useRouter();
  const [cant, setCant] = useState<string[]>(initialCantSitWith);
  const [must, setMust] = useState<string[]>(initialMustSitWith);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<"cant" | "must">("cant");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const others = useMemo(
    () => allGuests.filter((g) => g.id !== guestId),
    [allGuests, guestId],
  );
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return others.filter((g) => g.full_name.toLowerCase().includes(needle));
  }, [others, q]);

  const idToName = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of others) m.set(g.id, g.full_name);
    return m;
  }, [others]);

  const addRule = (otherId: string) => {
    if (active === "cant") {
      if (!cant.includes(otherId)) setCant([...cant, otherId]);
    } else {
      if (!must.includes(otherId)) setMust([...must, otherId]);
    }
    setQ("");
  };

  const removeCant = (id: string) => setCant((s) => s.filter((x) => x !== id));
  const removeMust = (id: string) => setMust((s) => s.filter((x) => x !== id));

  const save = async () => {
    setErr(null);
    setSaving(true);
    const supabase = createClient();
    const sb = supabase as unknown as {
      from: (t: string) => {
        update: (p: Record<string, unknown>) => {
          eq: (col: string, val: string) => Promise<{
            error: { message: string } | null;
          }>;
        };
      };
    };
    const { error } = await sb
      .from("guests")
      .update({
        cant_sit_with_guest_ids: cant,
        must_sit_with_guest_ids: must,
      })
      .eq("id", guestId);
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.refresh();
  };

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg">Seating rules</h3>
            <p className="text-xs text-muted-foreground">
              Used by the seating organizer + auto-arrange to keep{" "}
              {guestName}&rsquo;s table guests on side.
            </p>
          </div>
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </Button>
        </div>

        <div className="space-y-3">
          <RuleSection
            label="Can't sit with"
            tone="red"
            rules={cant}
            idToName={idToName}
            onRemove={removeCant}
          />
          <RuleSection
            label="Must sit with"
            tone="emerald"
            rules={must}
            idToName={idToName}
            onRemove={removeMust}
          />
        </div>

        <div className="rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-3">
          <div className="mb-2 flex gap-1">
            <button
              type="button"
              onClick={() => setActive("cant")}
              className={`rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] ${
                active === "cant"
                  ? "bg-red-100 text-red-900"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              + Can&rsquo;t sit with
            </button>
            <button
              type="button"
              onClick={() => setActive("must")}
              className={`rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] ${
                active === "must"
                  ? "bg-emerald-100 text-emerald-900"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              + Must sit with
            </button>
          </div>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search guests…"
            className="h-8"
          />
          {filtered.length > 0 && (
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {filtered.slice(0, 12).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => addRule(g.id)}
                  className="block w-full rounded-md px-2 py-1 text-left text-sm hover:bg-white"
                >
                  {g.full_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {err && (
          <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
            {err}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RuleSection({
  label,
  tone,
  rules,
  idToName,
  onRemove,
}: {
  label: string;
  tone: "red" | "emerald";
  rules: string[];
  idToName: Map<string, string>;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
        {label}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {rules.length === 0 ? (
          <span className="text-xs text-stone-400">None</span>
        ) : (
          rules.map((id) => (
            <Badge
              key={id}
              variant={tone === "red" ? "destructive" : "success"}
              className="inline-flex items-center gap-1 text-[10px]"
            >
              {idToName.get(id) ?? id.slice(0, 6)}
              <button
                type="button"
                onClick={() => onRemove(id)}
                className="opacity-70 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}
