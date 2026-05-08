"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@wedding-os/db";

type Visit = Database["public"]["Tables"]["venue_visits"]["Row"];

export function VisitsTab({
  venueId,
  initialVisits,
}: {
  venueId: string;
  initialVisits: Visit[];
}) {
  const router = useRouter();
  const [date, setDate] = useState<string>("");
  const [attendees, setAttendees] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [rating, setRating] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!date) {
      setError("Pick a visit date");
      return;
    }
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error: insErr } = await supabase.from("venue_visits").insert({
      venue_id: venueId,
      visit_date: date,
      attendees: attendees
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      walkthrough_notes: notes.trim() || null,
      couple_rating: rating ? Number(rating) : null,
    });
    setSubmitting(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setDate("");
    setAttendees("");
    setNotes("");
    setRating("");
    router.refresh();
  };

  const remove = async (visit: Visit) => {
    if (!confirm(`Delete visit on ${visit.visit_date}? Photos linked to it will keep their files.`)) return;
    const supabase = createClient();
    await supabase.from("venue_visits").delete().eq("id", visit.id);
    router.refresh();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        {initialVisits.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No visits logged yet.
            </CardContent>
          </Card>
        ) : (
          initialVisits.map((v) => (
            <Card key={v.id}>
              <CardContent className="space-y-2 py-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{format(parseISO(v.visit_date), "PPPP")}</div>
                    {v.attendees && v.attendees.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        With {v.attendees.join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {v.couple_rating !== null && (
                      <span className="text-muted-foreground">Rating: {v.couple_rating}/5</span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Delete visit"
                      onClick={() => remove(v)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {v.walkthrough_notes && (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {v.walkthrough_notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="h-fit lg:sticky lg:top-6">
        <CardHeader>
          <CardTitle className="font-serif">Log a visit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="vd">Date</Label>
            <Input id="vd" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="att">Attendees (comma-separated)</Label>
            <Input
              id="att"
              placeholder="who attended"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rating">Rating (1–5)</Label>
            <Input
              id="rating"
              inputMode="numeric"
              value={rating}
              onChange={(e) => setRating(e.target.value.replace(/[^\d]/g, "").slice(0, 1))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="vn">Walkthrough notes</Label>
            <Textarea
              id="vn"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleAdd} disabled={submitting || !date} className="w-full">
            {submitting ? "Saving…" : "Log visit"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
