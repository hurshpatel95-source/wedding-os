"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils";
import type { Database } from "@wedding-os/db";

type Venue = Database["public"]["Tables"]["venues"]["Row"];

interface Space {
  label: string;
  price_eur: number;
}

export function PricingTab({
  venue,
  role,
}: {
  venue: Venue;
  role: "admin" | "couple" | null;
}) {
  const isAdmin = role === "admin";
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [weekend, setWeekend] = useState(venue.hire_fee_weekend_eur?.toString() ?? "");
  const [friday, setFriday] = useState(venue.hire_fee_friday_eur?.toString() ?? "");
  const [sunday, setSunday] = useState(venue.hire_fee_sunday_eur?.toString() ?? "");
  const [weekday, setWeekday] = useState(venue.hire_fee_weekday_eur?.toString() ?? "");
  const [minWeekend, setMinWeekend] = useState(venue.minimum_pax_weekend?.toString() ?? "");
  const [minSunday, setMinSunday] = useState(venue.minimum_pax_sunday?.toString() ?? "");
  const [shortfall, setShortfall] = useState(venue.shortfall_per_pax_eur?.toString() ?? "");
  const [extraHour, setExtraHour] = useState(venue.extra_hour_eur?.toString() ?? "");
  const [spaces, setSpaces] = useState<Space[]>(venue.spaces ?? []);
  const [hireNotes, setHireNotes] = useState(venue.hire_fee_notes ?? "");

  const updateSpace = (i: number, patch: Partial<Space>) =>
    setSpaces((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addSpace = () => setSpaces((prev) => [...prev, { label: "", price_eur: 0 }]);
  const removeSpace = (i: number) => setSpaces((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: upErr } = await supabase
      .from("venues")
      .update({
        hire_fee_weekend_eur: weekend ? Number(weekend) : null,
        hire_fee_friday_eur: friday ? Number(friday) : null,
        hire_fee_sunday_eur: sunday ? Number(sunday) : null,
        hire_fee_weekday_eur: weekday ? Number(weekday) : null,
        minimum_pax_weekend: minWeekend ? Number(minWeekend) : null,
        minimum_pax_sunday: minSunday ? Number(minSunday) : null,
        shortfall_per_pax_eur: shortfall ? Number(shortfall) : null,
        extra_hour_eur: extraHour ? Number(extraHour) : null,
        spaces: spaces.filter((s) => s.label.trim().length > 0),
        hire_fee_notes: hireNotes.trim() || null,
      })
      .eq("id", venue.id);
    setSaving(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    router.refresh();
  };

  const spacesTotal = spaces.reduce((acc, s) => acc + Number(s.price_eur || 0), 0);

  // READ-ONLY view for couples
  if (!isAdmin) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif">Hire fees</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                <RateCell label="Saturday" value={venue.hire_fee_weekend_eur} />
                <RateCell label="Friday" value={venue.hire_fee_friday_eur} />
                <RateCell label="Sunday" value={venue.hire_fee_sunday_eur} />
                <RateCell label="Mon-Thu" value={venue.hire_fee_weekday_eur} />
              </dl>
              {(venue.minimum_pax_weekend || venue.minimum_pax_sunday) && (
                <div className="mt-4 rounded-md border bg-amber-50 p-3 text-sm">
                  <div className="font-medium text-amber-900">Minimum-pax shortfall fee</div>
                  <div className="text-xs text-amber-800">
                    Sat min {venue.minimum_pax_weekend ?? "—"} guests, Sun min{" "}
                    {venue.minimum_pax_sunday ?? "—"} guests · €
                    {venue.shortfall_per_pax_eur ?? "?"}/pax shortfall.
                  </div>
                </div>
              )}
              {venue.hire_fee_notes && (
                <p className="mt-3 whitespace-pre-wrap text-xs italic text-muted-foreground">
                  {venue.hire_fee_notes}
                </p>
              )}
            </CardContent>
          </Card>

          {(venue.spaces ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Spaces</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {(venue.spaces ?? []).map((s, i) => (
                    <li key={i} className="flex items-center justify-between py-2 text-sm">
                      <span>{s.label}</span>
                      <span className="font-medium">{formatMoney(s.price_eur, "EUR")}</span>
                    </li>
                  ))}
                  <li className="flex items-center justify-between border-t border-stone-300 pt-2 text-sm font-medium">
                    <span>Whole venue (all spaces)</span>
                    <span>{formatMoney(spacesTotal, "EUR")}</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit">
          <CardContent className="space-y-2 py-4 text-sm">
            <p className="text-stone-700">
              These are Astha's quoted hire fees. The full cost (catering, room block, vendor &
              misc) is on the{" "}
              <a href="/pricing" className="font-medium underline">
                Full pricing
              </a>{" "}
              page.
            </p>
            <p className="text-xs text-muted-foreground">
              Only the planner can edit these numbers.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ADMIN: editable form
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Hire fees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="grid gap-1.5">
              <Label>Saturday €</Label>
              <Input
                inputMode="decimal"
                value={weekend}
                onChange={(e) => setWeekend(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Friday €</Label>
              <Input
                inputMode="decimal"
                value={friday}
                onChange={(e) => setFriday(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="often = Sun"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Sunday €</Label>
              <Input
                inputMode="decimal"
                value={sunday}
                onChange={(e) => setSunday(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Mon-Thu €</Label>
              <Input
                inputMode="decimal"
                value={weekday}
                onChange={(e) => setWeekday(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="grid gap-1.5">
              <Label>Min pax — Sat</Label>
              <Input
                inputMode="numeric"
                value={minWeekend}
                onChange={(e) => setMinWeekend(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Min pax — Sun</Label>
              <Input
                inputMode="numeric"
                value={minSunday}
                onChange={(e) => setMinSunday(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Shortfall €/pax</Label>
              <Input
                inputMode="decimal"
                value={shortfall}
                onChange={(e) => setShortfall(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Extra hour €</Label>
              <Input
                inputMode="decimal"
                value={extraHour}
                onChange={(e) => setExtraHour(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Hire fee notes</Label>
            <Textarea
              rows={2}
              value={hireNotes}
              onChange={(e) => setHireNotes(e.target.value)}
              placeholder="e.g. 'Friday rate not quoted' or 'Weekday MORE expensive at this venue'"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-serif">Spaces (composite-priced venues)</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addSpace}>
              <Plus className="h-4 w-4" /> Add space
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {spaces.length === 0 ? (
            <p className="text-xs text-stone-500">
              For venues like Mas de Sant Llei where each area has its own price. Sum of selected
              spaces overrides the flat hire fee in scenarios.
            </p>
          ) : (
            <div className="space-y-2">
              {spaces.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Space label"
                    value={s.label}
                    onChange={(e) => updateSpace(i, { label: e.target.value })}
                  />
                  <Input
                    className="w-32"
                    inputMode="decimal"
                    placeholder="2000"
                    value={s.price_eur}
                    onChange={(e) =>
                      updateSpace(i, {
                        price_eur: Number(e.target.value.replace(/[^\d.]/g, "") || 0),
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove space"
                    onClick={() => removeSpace(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="border-t pt-2 text-sm">
                <span className="text-muted-foreground">Whole venue (all spaces): </span>
                <span className="font-medium">{formatMoney(spacesTotal, "EUR")}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save hire fees"}
        </Button>
        <Badge variant="muted" className="text-[10px]">
          Changes flow into all 3 scenarios on /pricing
        </Badge>
      </div>
    </div>
  );
}

function RateCell({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-serif text-2xl font-light">
        {value != null ? formatMoney(Number(value), "EUR") : "—"}
      </dd>
    </div>
  );
}
