import Link from "next/link";
import { BarChart3, Send, Upload, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { GuestList } from "@/components/guests/guest-list";
import { GuestCreateButton } from "@/components/guests/guest-create-button";
import { GuestComposeButton } from "@/components/email/guest-compose-button";
import type { Database } from "@wedding-os/db";

export const dynamic = "force-dynamic";

export default async function GuestsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: "admin" | "couple" | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = (profile?.role ?? null) as typeof role;
  }

  // plus_one_max is post-0025; types haven't regenerated. We select it
  // anyway and merge through a cast.
  const { data: guests } = await supabase
    .from("guests")
    .select(
      "id, full_name, email, phone, side, relationship, dietary, allergies, overall_rsvp, address, city, region, postal_code, country, notes, created_at, plus_one_max",
    )
    .order("full_name", { ascending: true });

  type GuestRow = Database["public"]["Tables"]["guests"]["Row"];
  const list = (guests ?? []) as unknown as Array<
    Pick<
      GuestRow,
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
    > & { plus_one_max: number | null }
  >;

  const total = list.length;
  const yes = list.filter((g) => g.overall_rsvp === "yes").length;
  const no = list.filter((g) => g.overall_rsvp === "no").length;
  const maybe = list.filter((g) => g.overall_rsvp === "maybe").length;
  const pending = list.filter((g) => g.overall_rsvp === "pending").length;

  const isAdmin = role === "admin";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Who's coming
          </div>
          <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
            Guest list
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Track invites, addresses, dietary needs, and RSVPs across every
            event. Import directly from your spreadsheet — we map the columns
            for you.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/guests/dashboard">
            <Button>
              <BarChart3 className="h-4 w-4" />
              Live dashboard
            </Button>
          </Link>
          <Link href="/guests/seating">
            <Button variant="outline">Seating organizer</Button>
          </Link>
          <Link href="/guests/message">
            <Button variant="outline">
              <Send className="h-4 w-4" /> Message guests
            </Button>
          </Link>
          <Link href="/guests/import">
            <Button variant="outline">
              <Upload className="h-4 w-4" /> Import from Excel
            </Button>
          </Link>
          <GuestCreateButton />
          {isAdmin && (
            <>
              <GuestComposeButton
                defaultKind="guest_save_the_date"
                label="Save-the-date"
                variant="outline"
              />
              {pending > 0 && (
                <GuestComposeButton
                  defaultKind="guest_rsvp_nudge"
                  defaultFilter={{ rsvp: "pending" }}
                  label={`Nudge ${pending} pending`}
                  variant="outline"
                />
              )}
            </>
          )}
        </div>
      </header>

      {total === 0 ? (
        <EmptyState
          icon={Users}
          title="No guests on your list yet"
          description="Drop in your existing spreadsheet — we map the columns for you. Or add guests one at a time. Every name flows into RSVP tracking, seating, and dietary lists automatically."
          action={
            <>
              <Button asChild>
                <Link href="/guests/import">
                  <Upload className="h-4 w-4" />
                  Import from Excel
                </Link>
              </Button>
              <GuestCreateButton />
            </>
          }
        />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Total" value={total} />
            <Stat label="Yes" value={yes} tone="emerald" />
            <Stat label="Maybe" value={maybe} tone="amber" />
            <Stat label="No" value={no} tone="rose" />
            <Stat label="Pending" value={pending} tone="muted" />
          </section>

          <GuestList guests={list} role={role} />
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "muted" | "emerald" | "amber" | "rose";
}) {
  const dot =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "amber"
      ? "bg-amber-500"
      : tone === "rose"
      ? "bg-rose-500"
      : "bg-stone-400";
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-stone-500">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-2 font-serif text-2xl font-light leading-none md:text-3xl">{value}</div>
    </div>
  );
}
