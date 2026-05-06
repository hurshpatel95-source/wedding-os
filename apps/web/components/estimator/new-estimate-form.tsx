"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatEUR } from "@/lib/estimator-types";

interface VenueOption {
  id: string;
  name: string;
  is_lead_pick: boolean;
}
interface TemplateOption {
  id: string;
  name: string;
  scenario_summary: string | null;
  cover_emoji: string | null;
  baseline_total_eur: number | null;
}

const EMOJI_OPTIONS = ["🌊", "🏔️", "🏛️", "🌸", "🌿", "💍", "🥂", "✨"];

interface Props {
  venues: VenueOption[];
  templates: TemplateOption[];
}

export function NewEstimateForm({ venues, templates }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [coverEmoji, setCoverEmoji] = useState("💍");
  const [guestCount, setGuestCount] = useState<number>(220);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [sangeetVenueId, setSangeetVenueId] = useState<string>("");
  const [weddingVenueId, setWeddingVenueId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!name.trim()) return setErr("Give your estimate a name.");
    if (!startDate || !endDate) return setErr("Pick both dates.");
    if (!templateId) return setErr("Pick a baseline template to clone from.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/estimator/new", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          cover_emoji: coverEmoji,
          guest_count: guestCount,
          start_date: startDate,
          end_date: endDate,
          sangeet_venue_id: sangeetVenueId || null,
          wedding_venue_id: weddingVenueId || null,
          base_template_id: templateId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't create the estimate.");
        return;
      }
      router.push(`/estimator/${data.id}`);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const leadVenues = venues.filter((v) => v.is_lead_pick);
  const otherVenues = venues.filter((v) => !v.is_lead_pick);

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card>
        <CardContent className="space-y-5 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Estimate name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Casa Del Mar + ME Barcelona (Friday option)"
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cover emoji</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setCoverEmoji(e)}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border text-xl transition",
                      coverEmoji === e
                        ? "border-rose-500 bg-rose-50 ring-2 ring-rose-200"
                        : "border-stone-200 hover:border-stone-400",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="guests">Guest count</Label>
              <Input
                id="guests"
                type="number"
                min={1}
                value={guestCount}
                onChange={(e) => setGuestCount(Number(e.target.value))}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start_date">Sangeet date</Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">Wedding date</Label>
              <Input
                id="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 py-6">
          <div>
            <h3 className="font-serif text-xl">Venues</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick a venue per event. Hire-fee is auto-detected based on day
              of week (Sat/Sun/weekday) when the venue has those rates set.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Sangeet venue</Label>
              <Select
                value={sangeetVenueId}
                onValueChange={setSangeetVenueId}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a venue (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {leadVenues.length > 0 && (
                    <>
                      <SelectItem value="__leadHeader" disabled>
                        — Lead picks —
                      </SelectItem>
                      {leadVenues.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          ★ {v.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {otherVenues.length > 0 && (
                    <>
                      <SelectItem value="__otherHeader" disabled>
                        — Other —
                      </SelectItem>
                      {otherVenues.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Wedding venue</Label>
              <Select
                value={weddingVenueId}
                onValueChange={setWeddingVenueId}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a venue (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {leadVenues.length > 0 && (
                    <>
                      <SelectItem value="__leadHeader2" disabled>
                        — Lead picks —
                      </SelectItem>
                      {leadVenues.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          ★ {v.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {otherVenues.length > 0 && (
                    <>
                      <SelectItem value="__otherHeader2" disabled>
                        — Other —
                      </SelectItem>
                      {otherVenues.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-6">
          <div className="flex items-baseline gap-2">
            <h3 className="font-serif text-xl">Baseline template</h3>
            <Badge variant="muted" className="text-[10px]">
              <Sparkles className="mr-1 h-3 w-3" />
              Astia line items
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            All lines (catering, mehendi, photography, transport, planner fee)
            copy across. The hire-fee line is replaced with your venue&rsquo;s
            day-rate where available.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-4 text-left transition",
                  templateId === t.id
                    ? "border-rose-500 bg-rose-50 ring-2 ring-rose-200"
                    : "border-stone-200 hover:border-stone-400",
                )}
                disabled={submitting}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-50 via-white to-amber-50 text-2xl">
                  {t.cover_emoji ?? "💍"}
                </div>
                <div className="min-w-0">
                  <div className="font-serif text-base">{t.name}</div>
                  <div className="line-clamp-1 text-[11px] text-muted-foreground">
                    {t.scenario_summary}
                  </div>
                  {t.baseline_total_eur != null && (
                    <div className="mt-1 text-[11px] uppercase tracking-[0.15em] text-stone-500">
                      baseline {formatEUR(t.baseline_total_eur)}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create estimate
        </Button>
      </div>
    </form>
  );
}
