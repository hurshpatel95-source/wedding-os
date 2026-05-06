"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Users, Camera } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_LABEL, STATUS_VARIANT, VENUE_STATUSES } from "@/lib/venue-status";
import { EVENT_ROLES, EVENT_ROLE_LABEL, EVENT_ROLE_SHORT } from "@/lib/event-roles";
import type { Database } from "@wedding-os/db";

type Venue = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  | "id"
  | "name"
  | "address"
  | "hero_photo_url"
  | "status"
  | "capacity_min"
  | "capacity_max"
  | "indoor_outdoor"
  | "in_house_catering"
  | "has_accommodation"
  | "event_roles"
  | "created_at"
>;

type EventRole = Database["public"]["Enums"]["event_role"];
type StatusFilter = "all" | Venue["status"];
type IOFilter = "all" | "indoor" | "outdoor" | "both";
type RoleFilter = "all" | EventRole;
type SortKey = "created" | "name" | "capacity";

export function VenueGrid({ venues }: { venues: Venue[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [role, setRole] = useState<RoleFilter>("all");
  const [io, setIO] = useState<IOFilter>("all");
  const [catering, setCatering] = useState<"any" | "yes" | "no">("any");
  const [minCapacity, setMinCapacity] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("created");

  const filtered = useMemo(() => {
    const min = minCapacity === "" ? null : Number(minCapacity);
    const needle = q.trim().toLowerCase();

    return venues
      .filter((v) => {
        if (needle && !`${v.name} ${v.address ?? ""}`.toLowerCase().includes(needle)) return false;
        if (status !== "all" && v.status !== status) return false;
        if (io !== "all" && v.indoor_outdoor !== io) return false;
        if (role !== "all" && !(v.event_roles ?? []).includes(role)) return false;
        if (catering === "yes" && !v.in_house_catering) return false;
        if (catering === "no" && v.in_house_catering) return false;
        if (min !== null && (v.capacity_max ?? 0) < min) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "capacity") return (b.capacity_max ?? 0) - (a.capacity_max ?? 0);
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
  }, [venues, q, status, role, io, catering, minCapacity, sort]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-7">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="q">Search</Label>
          <Input id="q" placeholder="Name or address" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {VENUE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Event role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as RoleFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              {EVENT_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {EVENT_ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Indoor/Outdoor</Label>
          <Select value={io} onValueChange={(v) => setIO(v as IOFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              <SelectItem value="indoor">Indoor</SelectItem>
              <SelectItem value="outdoor">Outdoor</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>In-house catering</Label>
          <Select value={catering} onValueChange={(v) => setCatering(v as typeof catering)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="minCap">Min capacity</Label>
          <Input
            id="minCap"
            inputMode="numeric"
            placeholder="e.g. 150"
            value={minCapacity}
            onChange={(e) => setMinCapacity(e.target.value.replace(/[^\d]/g, ""))}
          />
        </div>
        <div className="space-y-1.5 md:col-span-1 md:col-start-6">
          <Label>Sort</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created">Date added</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="capacity">Capacity (high → low)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No venues match these filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => (
            <Link key={v.id} href={`/venues/${v.id}`} className="group block">
              <Card className="h-full overflow-hidden border-stone-200 bg-white p-0 shadow-sm transition hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-md">
                <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-amber-100 via-rose-200 to-orange-300">
                  {v.hero_photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.hero_photo_url}
                      alt={v.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  <div className="absolute right-3 top-3">
                    <Badge
                      variant={STATUS_VARIANT[v.status]}
                      className="border-white/40 bg-white/85 text-[10px] uppercase tracking-wider text-stone-800 shadow-sm backdrop-blur"
                    >
                      {STATUS_LABEL[v.status]}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-5">
                  <h3 className="font-serif text-2xl font-medium leading-tight tracking-tight text-stone-900">
                    {v.name}
                  </h3>
                  {v.address && (
                    <div className="mt-1 flex items-center gap-1 text-sm text-stone-500">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="line-clamp-1">{v.address}</span>
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3 text-stone-600">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {v.capacity_min ?? "?"}–{v.capacity_max ?? "?"}
                      </span>
                      <span className="flex items-center gap-1 text-stone-400">
                        <Camera className="h-3.5 w-3.5" />
                        <span className="text-xs">photos</span>
                      </span>
                    </div>
                    <div className="text-xs uppercase tracking-wider text-stone-500">
                      {v.indoor_outdoor ?? "—"}
                    </div>
                  </div>
                  {(v.event_roles ?? []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1 border-t border-stone-100 pt-3">
                      {(v.event_roles ?? []).map((r) => (
                        <Badge key={r} variant="secondary" className="text-[10px]">
                          {EVENT_ROLE_SHORT[r]}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
