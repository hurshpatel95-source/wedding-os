"use client";

import { useMemo, useState } from "react";
import { Mail, Phone, Trash2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GuestFormDialog } from "@/components/guests/guest-form-dialog";
import {
  RSVP_LABEL,
  RSVP_VARIANT,
  RSVP_STATUSES,
  SIDE_LABEL,
  type RsvpStatus,
  type GuestSide,
} from "@/lib/guest-types";
import type { Database } from "@wedding-os/db";

type Guest = Pick<
  Database["public"]["Tables"]["guests"]["Row"],
  | "id"
  | "full_name"
  | "email"
  | "phone"
  | "side"
  | "relationship"
  | "dietary"
  | "allergies"
  | "overall_rsvp"
  | "address"
  | "city"
  | "region"
  | "postal_code"
  | "country"
  | "notes"
  | "created_at"
> & {
  // post-0025; not yet in generated types
  plus_one_max?: number | null;
};

type SideFilter = "all" | GuestSide;
type RsvpFilter = "all" | RsvpStatus;

export function GuestList({
  guests,
  role,
}: {
  guests: Guest[];
  role: "admin" | "couple" | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [side, setSide] = useState<SideFilter>("all");
  const [rsvp, setRsvp] = useState<RsvpFilter>("all");
  const [editing, setEditing] = useState<Guest | null>(null);
  const isAdmin = role === "admin";

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return guests.filter((g) => {
      if (side !== "all" && g.side !== side) return false;
      if (rsvp !== "all" && g.overall_rsvp !== rsvp) return false;
      if (
        needle &&
        ![g.full_name, g.email, g.phone, g.relationship, g.dietary]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(needle))
      )
        return false;
      return true;
    });
  }, [guests, q, side, rsvp]);

  const handleDelete = async (g: Guest) => {
    if (!confirm(`Delete ${g.full_name}?`)) return;
    const supabase = createClient();
    await supabase.from("guests").delete().eq("id", g.id);
    router.refresh();
  };

  const handleRsvpChange = async (g: Guest, next: RsvpStatus) => {
    const supabase = createClient();
    await supabase.from("guests").update({ overall_rsvp: next }).eq("id", g.id);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 md:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="q">Search</Label>
          <Input
            id="q"
            placeholder="Name, email, relationship, dietary…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Side</Label>
          <Select value={side} onValueChange={(v) => setSide(v as SideFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sides</SelectItem>
              <SelectItem value="groom">{SIDE_LABEL.groom}</SelectItem>
              <SelectItem value="bride">{SIDE_LABEL.bride}</SelectItem>
              <SelectItem value="both">{SIDE_LABEL.both}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>RSVP</Label>
          <Select value={rsvp} onValueChange={(v) => setRsvp(v as RsvpFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {RSVP_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {RSVP_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing {filtered.length} of {guests.length}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {guests.length === 0
              ? "No guests yet. Use the Import button to drop in your Excel list, or add one manually."
              : "No guests match these filters."}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-stone-50 text-[10px] uppercase tracking-[0.15em] text-stone-500">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Side</th>
                  <th className="px-3 py-2 text-left">Relationship</th>
                  <th className="px-3 py-2 text-left">Contact</th>
                  <th className="px-3 py-2 text-left">Dietary</th>
                  <th className="px-3 py-2 text-left">RSVP</th>
                  {isAdmin && <th className="px-3 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.id} className="border-t border-stone-100 hover:bg-stone-50/40">
                    <td className="px-3 py-2 font-medium">{g.full_name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {g.side ? SIDE_LABEL[g.side] : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {g.relationship ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div className="flex flex-col gap-0.5">
                        {g.email && (
                          <a
                            href={`mailto:${g.email}`}
                            className="flex items-center gap-1 hover:underline"
                          >
                            <Mail className="h-3 w-3" />
                            {g.email}
                          </a>
                        )}
                        {g.phone && (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`tel:${g.phone}`}
                              className="flex items-center gap-1 text-muted-foreground hover:underline"
                            >
                              <Phone className="h-3 w-3" />
                              {g.phone}
                            </a>
                            <WhatsAppLink
                              phone={g.phone}
                              text={`Hi ${(g.full_name ?? "").split(" ")[0] || "there"}!`}
                              variant="icon"
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {g.dietary ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {isAdmin ? (
                        <Select
                          value={g.overall_rsvp}
                          onValueChange={(v) => handleRsvpChange(g, v as RsvpStatus)}
                        >
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RSVP_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {RSVP_LABEL[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={RSVP_VARIANT[g.overall_rsvp]} className="text-[10px]">
                          {RSVP_LABEL[g.overall_rsvp]}
                        </Badge>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-2 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Edit"
                            onClick={() => setEditing(g)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Delete"
                            onClick={() => handleDelete(g)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {editing && (
        <GuestFormDialog open onOpenChange={(o) => !o && setEditing(null)} guest={editing} />
      )}
    </div>
  );
}
