"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  FloorPlanRow,
  SeatingAssignmentRow,
} from "@/lib/seating-types";

interface GuestRow {
  id: string;
  full_name: string;
  side: string | null;
  household_id: string | null;
  is_household_head: boolean;
  overall_rsvp: string;
  dietary: string | null;
  notes: string | null;
}

interface Props {
  plan: FloorPlanRow;
  guests: GuestRow[];
  initialAssignments: SeatingAssignmentRow[];
}

export function SeatingBoard({ plan, guests, initialAssignments }: Props) {
  const router = useRouter();
  const [assignments, setAssignments] = useState<SeatingAssignmentRow[]>(
    initialAssignments,
  );
  const [q, setQ] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hideRSVPno, setHideRSVPno] = useState(true);

  const guestById = useMemo(() => {
    const m = new Map<string, GuestRow>();
    for (const g of guests) m.set(g.id, g);
    return m;
  }, [guests]);

  const assignmentByGuest = useMemo(() => {
    const m = new Map<string, SeatingAssignmentRow>();
    for (const a of assignments) m.set(a.guest_id, a);
    return m;
  }, [assignments]);

  // Group assignments by table
  const byTable = useMemo(() => {
    const m = new Map<number, SeatingAssignmentRow[]>();
    for (const a of assignments) {
      const list = m.get(a.table_number) ?? [];
      list.push(a);
      m.set(a.table_number, list);
    }
    return m;
  }, [assignments]);

  const unassigned = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return guests.filter((g) => {
      if (assignmentByGuest.has(g.id)) return false;
      if (hideRSVPno && g.overall_rsvp === "no") return false;
      if (needle && !g.full_name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [guests, assignmentByGuest, q, hideRSVPno]);

  const assign = async (guestId: string, tableNumber: number | null) => {
    setErr(null);
    setPendingId(guestId);
    try {
      const res = await fetch("/api/seating/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          floor_plan_id: plan.id,
          guest_id: guestId,
          table_number: tableNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't update assignment.");
        return;
      }
      // Optimistically update local state
      if (tableNumber == null) {
        setAssignments((prev) => prev.filter((a) => a.guest_id !== guestId));
      } else {
        setAssignments((prev) => {
          const existing = prev.find((a) => a.guest_id === guestId);
          if (existing) {
            return prev.map((a) =>
              a.guest_id === guestId
                ? { ...a, table_number: tableNumber }
                : a,
            );
          }
          return [
            ...prev,
            {
              id: `tmp-${guestId}`,
              floor_plan_id: plan.id,
              guest_id: guestId,
              table_number: tableNumber,
              seat_number: null,
              notes: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ];
        });
      }
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPendingId(null);
    }
  };

  const tables = Array.from({ length: plan.table_count }, (_, i) => i + 1);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Unassigned guests sidebar */}
      <Card className="h-fit lg:sticky lg:top-24">
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                Unassigned
              </div>
              <div className="font-serif text-2xl">{unassigned.length}</div>
            </div>
            <Badge variant="muted" className="text-[10px]">
              {assignments.length} / {plan.table_count * plan.seats_per_table} seated
            </Badge>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search guests"
              className="pl-9"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-stone-600">
            <input
              type="checkbox"
              checked={hideRSVPno}
              onChange={(e) => setHideRSVPno(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-stone-300"
            />
            Hide RSVP&nbsp;=&nbsp;no
          </label>

          {err && (
            <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
              {err}
            </div>
          )}

          <div className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
            {unassigned.map((g) => (
              <UnassignedGuestRow
                key={g.id}
                guest={g}
                tables={tables}
                onAssign={(t) => assign(g.id, t)}
                pending={pendingId === g.id}
              />
            ))}
            {unassigned.length === 0 && (
              <div className="text-xs text-muted-foreground">
                Everyone&rsquo;s seated. ✨
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tables grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tables.map((t) => {
          const seated = byTable.get(t) ?? [];
          const free = plan.seats_per_table - seated.length;
          const overFull = free < 0;
          return (
            <Card
              key={t}
              className={cn(
                "h-fit transition",
                overFull ? "border-red-300 bg-red-50/40" : "",
                seated.length === 0 ? "opacity-90" : "",
              )}
            >
              <CardContent className="space-y-2 py-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-serif text-xl">Table {t}</h3>
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-[0.2em]",
                      overFull
                        ? "text-red-700"
                        : free === 0
                        ? "text-emerald-700"
                        : "text-stone-500",
                    )}
                  >
                    {seated.length} / {plan.seats_per_table}
                  </span>
                </div>

                <div className="space-y-1">
                  {seated.length === 0 ? (
                    <div className="rounded-md border border-dashed border-stone-200 px-3 py-3 text-xs text-stone-400">
                      Empty
                    </div>
                  ) : (
                    seated.map((a) => {
                      const g = guestById.get(a.guest_id);
                      if (!g) return null;
                      return (
                        <div
                          key={a.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-stone-100 px-2 py-1 text-sm"
                        >
                          <div className="min-w-0">
                            <div className="line-clamp-1 font-medium">
                              {g.full_name}
                            </div>
                            <div className="text-[10px] text-stone-500">
                              {[g.side, g.dietary].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => assign(g.id, null)}
                            disabled={pendingId === g.id}
                            className="text-stone-300 transition hover:text-rose-600"
                            title="Unseat"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                <Select
                  value=""
                  onValueChange={(val) => {
                    if (val) assign(val, t);
                  }}
                  disabled={overFull && false}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="+ Add guest" />
                  </SelectTrigger>
                  <SelectContent>
                    {unassigned.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        Nobody available
                      </SelectItem>
                    ) : (
                      unassigned.slice(0, 30).map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.full_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function UnassignedGuestRow({
  guest,
  tables,
  onAssign,
  pending,
}: {
  guest: GuestRow;
  tables: number[];
  onAssign: (t: number) => void;
  pending: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-md border border-stone-100 bg-white px-2 py-1.5 text-sm",
        pending && "opacity-60",
        guest.overall_rsvp === "no" && "bg-stone-50 text-stone-500",
      )}
    >
      <div className="min-w-0">
        <div className="line-clamp-1 font-medium">{guest.full_name}</div>
        <div className="flex items-center gap-1.5 text-[10px] text-stone-500">
          {guest.side && <span>{guest.side}</span>}
          {guest.overall_rsvp && guest.overall_rsvp !== "pending" && (
            <Badge
              variant={
                guest.overall_rsvp === "yes"
                  ? "success"
                  : guest.overall_rsvp === "no"
                  ? "destructive"
                  : "warning"
              }
              className="px-1.5 py-0 text-[9px]"
            >
              {guest.overall_rsvp}
            </Badge>
          )}
        </div>
      </div>
      <Select onValueChange={(v) => onAssign(Number(v))} disabled={pending}>
        <SelectTrigger className="h-7 w-20 text-[10px]">
          <SelectValue placeholder="seat" />
        </SelectTrigger>
        <SelectContent>
          {tables.map((t) => (
            <SelectItem key={t} value={String(t)}>
              T{t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
