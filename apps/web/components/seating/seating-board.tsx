"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Search, Sparkles, Users, X } from "lucide-react";
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
  cant_sit_with_guest_ids: string[] | null;
  must_sit_with_guest_ids: string[] | null;
}

/** Returns the bidirectional union of two guests' incompat sets. */
function isConflict(a: GuestRow, b: GuestRow): boolean {
  const aBlocks = a.cant_sit_with_guest_ids ?? [];
  const bBlocks = b.cant_sit_with_guest_ids ?? [];
  return aBlocks.includes(b.id) || bBlocks.includes(a.id);
}

/** Find conflicts at a table for a given candidate guest. */
function conflictsAt(
  candidate: GuestRow,
  tableGuestIds: string[],
  byId: Map<string, GuestRow>,
): GuestRow[] {
  const out: GuestRow[] = [];
  for (const id of tableGuestIds) {
    const other = byId.get(id);
    if (!other) continue;
    if (isConflict(candidate, other)) out.push(other);
  }
  return out;
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

  // Pre-compute table → guest_ids map for conflict checks (used by table cards)
  const tableGuestIds = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const a of assignments) {
      const list = m.get(a.table_number) ?? [];
      list.push(a.guest_id);
      m.set(a.table_number, list);
    }
    return m;
  }, [assignments]);

  // Build a list of all conflicts currently in play (warning banner)
  const conflictAlerts = useMemo(() => {
    const found: { table: number; a: GuestRow; b: GuestRow }[] = [];
    for (const [tNum, ids] of tableGuestIds) {
      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) {
          const a = guestById.get(ids[i]);
          const b = guestById.get(ids[j]);
          if (a && b && isConflict(a, b)) {
            found.push({ table: tNum, a, b });
          }
        }
      }
    }
    return found;
  }, [tableGuestIds, guestById]);

  // Auto-arrange: assign guests greedy-style, respecting cant_sit_with
  // and household groupings. Only places guests with RSVP=yes or pending.
  const autoArrange = async () => {
    if (
      !confirm(
        "Auto-arrange will replace ALL current assignments on this plan with a fresh draft. Continue?",
      )
    )
      return;
    setErr(null);
    setPendingId("__auto");
    try {
      // 1. Clear existing
      for (const a of assignments) {
        await fetch("/api/seating/assign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            floor_plan_id: plan.id,
            guest_id: a.guest_id,
            table_number: null,
          }),
        });
      }

      // 2. Group guests with hard ties:
      //    (a) household_id, (b) must_sit_with edges. Build connected
      //    components via union-find so a chain A↔B↔C ends up together.
      const eligibleGuests = guests.filter(
        (g) => g.overall_rsvp === "yes" || g.overall_rsvp === "pending",
      );

      const parent = new Map<string, string>();
      const find = (x: string): string => {
        const p = parent.get(x);
        if (!p || p === x) return x;
        const root = find(p);
        parent.set(x, root);
        return root;
      };
      const union = (a: string, b: string) => {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) parent.set(ra, rb);
      };

      const eligibleIds = new Set(eligibleGuests.map((g) => g.id));
      for (const g of eligibleGuests) {
        if (!parent.has(g.id)) parent.set(g.id, g.id);
      }

      // Union by household
      const byHousehold = new Map<string, string[]>();
      for (const g of eligibleGuests) {
        if (!g.household_id) continue;
        const arr = byHousehold.get(g.household_id) ?? [];
        arr.push(g.id);
        byHousehold.set(g.household_id, arr);
      }
      for (const ids of byHousehold.values()) {
        for (let i = 1; i < ids.length; i += 1) union(ids[0], ids[i]);
      }

      // Union by must_sit_with (bidirectional)
      for (const g of eligibleGuests) {
        for (const id of g.must_sit_with_guest_ids ?? []) {
          if (eligibleIds.has(id)) union(g.id, id);
        }
      }

      // Roll up into groups
      const groupsMap = new Map<string, GuestRow[]>();
      for (const g of eligibleGuests) {
        const r = find(g.id);
        const arr = groupsMap.get(r) ?? [];
        arr.push(g);
        groupsMap.set(r, arr);
      }
      const groups: GuestRow[][] = Array.from(groupsMap.values()).sort(
        (a, b) => b.length - a.length,
      );

      // 3. Greedy place each group at the first table that has space AND
      //    no conflicts with anyone already there.
      const tableState = new Map<number, GuestRow[]>();
      for (let t = 1; t <= plan.table_count; t += 1) tableState.set(t, []);

      const placeAttempts: { guest: GuestRow; table: number }[] = [];

      for (const group of groups) {
        // Find the lowest-index table that fits the whole group
        // and has no conflict with any group member
        let chosen: number | null = null;
        for (let t = 1; t <= plan.table_count; t += 1) {
          const seated = tableState.get(t) ?? [];
          if (seated.length + group.length > plan.seats_per_table) continue;
          let conflict = false;
          for (const g of group) {
            for (const s of seated) {
              if (isConflict(g, s)) {
                conflict = true;
                break;
              }
            }
            if (conflict) break;
          }
          if (!conflict) {
            chosen = t;
            break;
          }
        }
        // If no clean table, drop into the smallest table with space (best effort)
        if (chosen == null) {
          let best: number | null = null;
          let bestSize = plan.seats_per_table + 1;
          for (let t = 1; t <= plan.table_count; t += 1) {
            const seated = tableState.get(t) ?? [];
            if (seated.length + group.length > plan.seats_per_table) continue;
            if (seated.length < bestSize) {
              best = t;
              bestSize = seated.length;
            }
          }
          chosen = best;
        }
        if (chosen == null) continue; // ran out of capacity
        const seated = tableState.get(chosen) ?? [];
        for (const g of group) {
          seated.push(g);
          placeAttempts.push({ guest: g, table: chosen });
        }
        tableState.set(chosen, seated);
      }

      // 4. POST all the assignments
      for (const p of placeAttempts) {
        await fetch("/api/seating/assign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            floor_plan_id: plan.id,
            guest_id: p.guest.id,
            table_number: p.table,
          }),
        });
      }

      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Conflict banner */}
      {conflictAlerts.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50/80 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-red-900">
            <AlertTriangle className="h-4 w-4" />
            {conflictAlerts.length} seating conflict{conflictAlerts.length === 1 ? "" : "s"}
          </div>
          <ul className="mt-1 space-y-0.5 text-xs text-red-800">
            {conflictAlerts.slice(0, 5).map((c, i) => (
              <li key={i}>
                Table {c.table}: <b>{c.a.full_name}</b> + <b>{c.b.full_name}</b>{" "}
                are flagged &ldquo;can&rsquo;t sit together&rdquo;
              </li>
            ))}
            {conflictAlerts.length > 5 && (
              <li className="opacity-80">+ {conflictAlerts.length - 5} more</li>
            )}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={autoArrange}
          disabled={pendingId === "__auto"}
          variant="outline"
          size="sm"
        >
          <Sparkles className="mr-1 h-3.5 w-3.5" />
          {pendingId === "__auto" ? "Arranging…" : "Auto-arrange"}
        </Button>
        <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
          Respects households + can&rsquo;t-sit-with rules · ignores RSVP=no
        </span>
      </div>

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
          const seatedGuestIds = seated.map((a) => a.guest_id);
          const tableHasConflict = (() => {
            for (let i = 0; i < seatedGuestIds.length; i += 1) {
              for (let j = i + 1; j < seatedGuestIds.length; j += 1) {
                const a = guestById.get(seatedGuestIds[i]);
                const b = guestById.get(seatedGuestIds[j]);
                if (a && b && isConflict(a, b)) return true;
              }
            }
            return false;
          })();
          return (
            <Card
              key={t}
              className={cn(
                "h-fit transition",
                overFull
                  ? "border-red-300 bg-red-50/40"
                  : tableHasConflict
                  ? "border-red-300 bg-red-50/30"
                  : "",
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
                {tableHasConflict && (
                  <div className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800">
                    <AlertTriangle className="h-3 w-3" />
                    Conflict at this table
                  </div>
                )}

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
