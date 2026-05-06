"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, MapPin, Users } from "lucide-react";
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
import { EVENT_ROLES, EVENT_ROLE_LABEL, EVENT_ROLE_SHORT } from "@/lib/event-roles";
import type { Database } from "@wedding-os/db";

type EventRole = Database["public"]["Enums"]["event_role"];

interface VenueRow {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  country: string | null;
  capacity_seated: number | null;
  capacity_standing: number | null;
  hire_fee_eur: number | null;
  event_roles: string[];
  created_at: string;
  hero_url: string | null;
}

type SortKey = "name" | "capacity" | "hire_fee" | "created";
type RoleFilter = "all" | EventRole;

export function LibraryVenueGrid({ venues }: { venues: VenueRow[] }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [sort, setSort] = useState<SortKey>("name");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return venues
      .filter((v) => {
        if (
          needle &&
          !`${v.name} ${v.city ?? ""} ${v.region ?? ""} ${v.country ?? ""}`
            .toLowerCase()
            .includes(needle)
        )
          return false;
        if (role !== "all" && !v.event_roles.includes(role)) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "capacity")
          return (b.capacity_seated ?? 0) - (a.capacity_seated ?? 0);
        if (sort === "hire_fee")
          return (b.hire_fee_eur ?? 0) - (a.hire_fee_eur ?? 0);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [venues, q, role, sort]);

  if (venues.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-stone-300" />
          <p className="text-sm text-stone-500">
            No venues in your library yet.
          </p>
          <p className="mt-1 text-xs text-stone-400">
            Hit &quot;New venue&quot; to add the first one.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="q">Search</Label>
          <Input
            id="q"
            placeholder="Name, city, region…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
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
          <Label>Sort</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name (A–Z)</SelectItem>
              <SelectItem value="capacity">Capacity (high → low)</SelectItem>
              <SelectItem value="hire_fee">Hire fee (high → low)</SelectItem>
              <SelectItem value="created">Newest first</SelectItem>
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
            <Link
              key={v.id}
              href={`/admin/library/venues/${v.id}`}
              className="group block"
            >
              <Card className="h-full overflow-hidden border-stone-200 bg-white p-0 shadow-sm transition hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-md">
                <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-amber-100 via-rose-200 to-orange-300">
                  {v.hero_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.hero_url}
                      alt={v.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Building2 className="h-10 w-10 text-white/80" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>
                <CardContent className="p-5">
                  <h3 className="font-serif text-2xl font-medium leading-tight tracking-tight text-stone-900">
                    {v.name}
                  </h3>
                  {(v.city || v.region || v.country) && (
                    <div className="mt-1 flex items-center gap-1 text-sm text-stone-500">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="line-clamp-1">
                        {[v.city, v.region, v.country]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-between text-sm text-stone-600">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {v.capacity_seated ?? "?"}
                      {v.capacity_standing ? `–${v.capacity_standing}` : ""}
                    </span>
                    <span className="text-xs uppercase tracking-wider text-stone-500">
                      {v.hire_fee_eur != null
                        ? `€${v.hire_fee_eur.toLocaleString()}`
                        : "—"}
                    </span>
                  </div>
                  {v.event_roles.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1 border-t border-stone-100 pt-3">
                      {v.event_roles.map((r) => (
                        <Badge
                          key={r}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {EVENT_ROLE_SHORT[r as EventRole] ?? r}
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
