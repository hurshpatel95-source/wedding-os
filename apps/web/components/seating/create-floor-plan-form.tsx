"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VenueOpt {
  id: string;
  name: string;
}

const EVENT_ROLES = [
  { value: "sangeet", label: "Sangeet" },
  { value: "welcome", label: "Welcome / Mehndi" },
  { value: "ceremony", label: "Ceremony" },
  { value: "reception", label: "Reception" },
  { value: "wedding", label: "Wedding (combined)" },
  { value: "haldi", label: "Haldi / Pithi" },
  { value: "stay", label: "Stay-only" },
];

export function CreateFloorPlanForm({ venues }: { venues: VenueOpt[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [venueId, setVenueId] = useState<string>("");
  const [eventRole, setEventRole] = useState<string>("");
  const [tableCount, setTableCount] = useState<number>(22);
  const [seatsPerTable, setSeatsPerTable] = useState<number>(10);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) return setErr("Give the plan a name.");
    if (tableCount < 1 || seatsPerTable < 1) return setErr("Counts must be ≥ 1.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/seating/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          venue_id: venueId || null,
          event_role: eventRole || null,
          table_count: tableCount,
          seats_per_table: seatsPerTable,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't create plan.");
        return;
      }
      router.push(`/guests/seating/${data.id}`);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Plan name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Wedding day — MSL"
            disabled={submitting}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Venue (optional)</Label>
          <Select value={venueId} onValueChange={setVenueId} disabled={submitting}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a venue" />
            </SelectTrigger>
            <SelectContent>
              {venues.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Event</Label>
          <Select value={eventRole} onValueChange={setEventRole} disabled={submitting}>
            <SelectTrigger>
              <SelectValue placeholder="Pick an event" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tables">Tables</Label>
          <Input
            id="tables"
            type="number"
            min={1}
            max={200}
            value={tableCount}
            onChange={(e) => setTableCount(Number(e.target.value))}
            disabled={submitting}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="seats">Seats per table</Label>
          <Input
            id="seats"
            type="number"
            min={1}
            max={50}
            value={seatsPerTable}
            onChange={(e) => setSeatsPerTable(Number(e.target.value))}
            disabled={submitting}
          />
        </div>
      </div>

      <div className="text-[11px] uppercase tracking-[0.2em] text-stone-500">
        Total capacity: {tableCount * seatsPerTable} seats
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <Button type="submit" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Create floor plan
      </Button>
    </form>
  );
}
