import { differenceInCalendarDays, formatDistanceToNow, parseISO } from "date-fns";
import Link from "next/link";
import { ArrowRight, Camera, MapPin, Sparkles, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/venue-status";
import { Badge } from "@/components/ui/badge";
import { WelcomeBanner } from "@/components/couples-welcome/welcome-banner";

type ActivityTone = "rose" | "amber" | "emerald" | "stone";
type ActivityKind =
  | "note"
  | "visit"
  | "photo"
  | "decision"
  | "question"
  | "answer"
  | "vendor";

interface ActivityEntry {
  kind: ActivityKind;
  label: string;
  sub: string;
  occurred_at: string;
  tone: ActivityTone;
}

function excerpt(text: string, max = 60): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function timeAgo(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export default async function DashboardPage() {
  const supabase = createClient();

  // `vendors` is not in the generated Database types yet; cast for that one call.
  const sbVendors = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => {
          limit: (
            n: number,
          ) => Promise<{ data: { id: string; name: string; created_at: string }[] | null }>;
        };
      };
    };
  };

  const [
    { data: workspace },
    { data: venues },
    { count: notesCount },
    { data: recentNotes },
    { data: recentVisits },
    { data: recentPhotos },
    { data: recentDecisions },
    { data: recentQuestions },
    { data: recentVendors },
  ] = await Promise.all([
    supabase
      .from("workspaces")
      .select("name, wedding_date, base_currency")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("venues")
      .select(
        "id, name, address, hero_photo_url, status, capacity_min, capacity_max, is_lead_pick",
      )
      .order("is_lead_pick", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase.from("venue_notes").select("id", { count: "exact", head: true }),
    supabase
      .from("venue_notes")
      .select("id, created_at, venue:venues(name)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("venue_visits")
      .select("id, visit_date, created_at, venue:venues(name)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("venue_photos")
      .select("id, created_at, venue:venues(name)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("venue_decisions")
      .select("id, kind, body, created_at, venue:venues(name)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("venue_questions")
      .select("id, body, status, answered_at, created_at, venue:venues(name)")
      .order("created_at", { ascending: false })
      .limit(5),
    sbVendors
      .from("vendors")
      .select("id, name, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // ── Estimated total — pull from the most recent active budget estimate
  // (couple's honest-budget view from /estimator). Falls back to first
  // pricing scenario if no estimate exists yet.
  let estimatedTotalEur: number | null = null;
  try {
    const sbEst = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => Promise<{
          data: Array<{ baseline_total_eur: number | null }> | null;
        }>;
      };
    };
    const { data: estimates } = await sbEst
      .from("budget_estimates")
      .select("baseline_total_eur");
    const totals = (estimates ?? [])
      .map((e) => Number(e.baseline_total_eur ?? 0))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (totals.length > 0) {
      estimatedTotalEur = Math.min(...totals); // cheapest scenario = the floor
    }
  } catch {
    estimatedTotalEur = null;
  }
  if (estimatedTotalEur == null) {
    const { data: scen } = await supabase
      .from("pricing_scenarios")
      .select("calculated_total")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const t = Number((scen as { calculated_total: number | null } | null)?.calculated_total ?? 0);
    if (t > 0) estimatedTotalEur = t;
  }

  // ── Due-this-week ───────────────────────────────────────────────────
  // Pull open planning_tasks with due_date in the next 14 days, plus
  // unpaid vendor deposits + finals due in the next 30 days. Combined,
  // sorted by date. Surfaces what the couple needs to actually do.
  const sbDue = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => Promise<{
        data: Record<string, unknown>[] | null;
      }>;
    };
  };

  const [{ data: dueTasksRaw }, { data: dueVendorsRaw }] = await Promise.all([
    sbDue
      .from("planning_tasks")
      .select("id, title, status, due_date, phase"),
    sbDue
      .from("vendors")
      .select(
        "id, name, deposit_amount_eur, deposit_due_at, deposit_paid_at, final_balance_eur, final_due_at, final_paid_at",
      ),
  ]);

  type DueItem = {
    id: string;
    label: string;
    sub: string;
    due_date: string;
    href: string;
    kind: "task" | "deposit" | "final";
  };
  const now = Date.now();
  const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
  const dueItems: DueItem[] = [];
  for (const t of (dueTasksRaw ?? []) as Array<Record<string, unknown>>) {
    if (t.status === "done") continue;
    const due = t.due_date as string | null;
    if (!due) continue;
    const dt = new Date(due).getTime();
    if (isNaN(dt) || dt - now > TWO_WEEKS || dt - now < -TWO_WEEKS) continue;
    dueItems.push({
      id: `task-${t.id}`,
      label: String(t.title ?? "Task"),
      sub: t.phase ? String(t.phase).replace(/_/g, " ") : "Plan",
      due_date: due,
      href: "/plan",
      kind: "task",
    });
  }
  for (const v of (dueVendorsRaw ?? []) as Array<Record<string, unknown>>) {
    if (v.deposit_amount_eur != null && !v.deposit_paid_at && v.deposit_due_at) {
      const due = String(v.deposit_due_at);
      const dt = new Date(due).getTime();
      if (
        !isNaN(dt) &&
        dt - now <= 30 * 24 * 60 * 60 * 1000 &&
        dt - now > -7 * 24 * 60 * 60 * 1000
      ) {
        dueItems.push({
          id: `dep-${v.id}`,
          label: `Deposit: ${String(v.name)}`,
          sub: `€${Number(v.deposit_amount_eur).toLocaleString()} due`,
          due_date: due,
          href: "/payments",
          kind: "deposit",
        });
      }
    }
    if (v.final_balance_eur != null && !v.final_paid_at && v.final_due_at) {
      const due = String(v.final_due_at);
      const dt = new Date(due).getTime();
      if (
        !isNaN(dt) &&
        dt - now <= 30 * 24 * 60 * 60 * 1000 &&
        dt - now > -7 * 24 * 60 * 60 * 1000
      ) {
        dueItems.push({
          id: `fin-${v.id}`,
          label: `Final: ${String(v.name)}`,
          sub: `€${Number(v.final_balance_eur).toLocaleString()} due`,
          due_date: due,
          href: "/payments",
          kind: "final",
        });
      }
    }
  }
  dueItems.sort((a, b) => +new Date(a.due_date) - +new Date(b.due_date));
  const dueWindow = dueItems.slice(0, 8);

  const daysUntil = workspace?.wedding_date
    ? differenceInCalendarDays(parseISO(workspace.wedding_date), new Date())
    : null;

  const venueList = venues ?? [];

  // Normalize the embedded venue join — supabase-js can return either an
  // object or a single-element array depending on FK metadata.
  const venueName = (v: unknown): string => {
    if (!v) return "a venue";
    if (Array.isArray(v)) return (v[0] as { name?: string } | undefined)?.name ?? "a venue";
    return (v as { name?: string }).name ?? "a venue";
  };

  const activity: ActivityEntry[] = [];

  for (const n of recentNotes ?? []) {
    activity.push({
      kind: "note",
      label: "Note added",
      sub: `${venueName((n as { venue: unknown }).venue)} · ${timeAgo(n.created_at)}`,
      occurred_at: n.created_at,
      tone: "rose",
    });
  }
  for (const v of recentVisits ?? []) {
    activity.push({
      kind: "visit",
      label: "Visit logged",
      sub: `${venueName((v as { venue: unknown }).venue)} · ${v.visit_date}`,
      occurred_at: v.created_at,
      tone: "stone",
    });
  }
  for (const p of recentPhotos ?? []) {
    activity.push({
      kind: "photo",
      label: "Photo added",
      sub: `${venueName((p as { venue: unknown }).venue)} · ${timeAgo(p.created_at)}`,
      occurred_at: p.created_at,
      tone: "stone",
    });
  }
  for (const d of recentDecisions ?? []) {
    activity.push({
      kind: "decision",
      label: `Decision: ${d.kind}`,
      sub: `${venueName((d as { venue: unknown }).venue)} · ${excerpt(d.body)}`,
      occurred_at: d.created_at,
      tone: "emerald",
    });
  }
  for (const q of recentQuestions ?? []) {
    const name = venueName((q as { venue: unknown }).venue);
    activity.push({
      kind: "question",
      label: "Question asked",
      sub: `${excerpt(q.body)} · ${name}`,
      occurred_at: q.created_at,
      tone: "amber",
    });
    if (q.status === "answered" && q.answered_at) {
      activity.push({
        kind: "answer",
        label: "Answered",
        sub: `${name} · ${timeAgo(q.answered_at)}`,
        occurred_at: q.answered_at,
        tone: "emerald",
      });
    }
  }
  for (const vd of recentVendors ?? []) {
    activity.push({
      kind: "vendor",
      label: "Vendor added",
      sub: `${vd.name} · ${timeAgo(vd.created_at)}`,
      occurred_at: vd.created_at,
      tone: "stone",
    });
  }

  activity.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
  const recentActivity = activity.slice(0, 8);

  // Stats
  const venuesScouted = venueList.filter((v) =>
    ["visited", "quoted", "decided"].includes(v.status as string),
  ).length;

  const decisionsLogged = notesCount ?? 0;

  // Top 3 for shortlist
  const shortlist = venueList.slice(0, 3);

  return (
    <div className="space-y-12">
      {workspace?.created_at && (
        <WelcomeBanner workspaceCreatedAt={workspace.created_at} />
      )}
      {/* Hero */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-8">
          <div className="mb-4 text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Your wedding planning, organized
          </div>
          <h1 className="font-serif text-5xl font-light leading-[1.05] tracking-tight md:text-6xl">
            {venueList.length > 0 ? (
              <>
                {venueList.length} venue{venueList.length === 1 ? "" : "s"}.
                <br />
                <span className="italic text-rose-700">
                  One decision
                </span>{" "}
                away.
              </>
            ) : (
              <>
                A wedding,
                <br />
                <span className="italic text-rose-700">
                  beautifully
                </span>{" "}
                organized.
              </>
            )}
          </h1>
          <p className="mt-6 max-w-xl leading-relaxed text-stone-600">
            All your scouting, photos, notes, and pricing in one place — no more hunting
            through WhatsApp threads or PDFs to remember which courtyard belonged to which
            venue.
            {daysUntil !== null && daysUntil > 0 && (
              <>
                {" "}
                <span className="text-stone-900">
                  {daysUntil} days until {workspace?.wedding_date}.
                </span>
              </>
            )}
          </p>
        </div>

        <aside className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm lg:col-span-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-stone-500">
            Latest activity
          </div>
          {recentActivity.length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">
              Quiet so far — start by adding a note on a venue.
            </p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {recentActivity.map((a, i) => (
                <ActivityItem key={i} label={a.label} sub={a.sub} tone={a.tone} />
              ))}
            </ul>
          )}
        </aside>
      </section>

      {/* Stats strip */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Venues scouted"
          value={String(venuesScouted)}
          sub={`of ${venueList.length} on the list`}
        />
        <StatCard
          label="Questions for venues"
          value="—"
          sub="Track them on each venue"
        />
        <StatCard
          label="Working budget"
          value={
            estimatedTotalEur != null
              ? `€${Math.round(estimatedTotalEur).toLocaleString()}`
              : "—"
          }
          sub={
            estimatedTotalEur != null
              ? "Your honest-budget estimate"
              : "Set yours in the Estimator"
          }
        />
        <StatCard
          label="Notes captured"
          value={String(decisionsLogged)}
          sub="Across every venue"
        />
      </section>

      {/* Due soon */}
      {dueWindow.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/50 via-white to-rose-50/30 p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-amber-900">
                Due in the next 2 weeks
              </div>
              <h3 className="mt-1 font-serif text-2xl">
                {dueWindow.length} thing{dueWindow.length === 1 ? "" : "s"} to handle
              </h3>
            </div>
          </div>
          <ul className="divide-y divide-stone-200/60">
            {dueWindow.map((item) => {
              const dt = new Date(item.due_date);
              const daysOff = Math.round(
                (dt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              );
              const overdue = daysOff < 0;
              const label =
                overdue
                  ? `${Math.abs(daysOff)}d overdue`
                  : daysOff === 0
                  ? "today"
                  : daysOff === 1
                  ? "tomorrow"
                  : `in ${daysOff}d`;
              return (
                <li key={item.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1">
                    <Link
                      href={item.href}
                      className="font-medium text-stone-900 hover:underline"
                    >
                      {item.label}
                    </Link>
                    <div className="text-[11px] uppercase tracking-[0.15em] text-stone-500">
                      {item.sub}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] uppercase tracking-[0.15em] ${
                      overdue
                        ? "text-rose-700"
                        : daysOff <= 3
                        ? "text-amber-700"
                        : "text-stone-500"
                    }`}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Shortlist */}
      <section>
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-[0.25em] text-stone-500">
              In consideration
            </div>
            <h2 className="font-serif text-3xl font-light tracking-tight">
              Venue shortlist
            </h2>
          </div>
          <Link
            href="/venues"
            className="flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {shortlist.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white/50 px-6 py-16 text-center">
            <Sparkles className="mx-auto mb-3 h-8 w-8 text-stone-300" />
            <p className="font-serif text-xl text-stone-700">No venues yet</p>
            <p className="mt-2 text-sm text-stone-500">
              Add your first venue from the{" "}
              <Link href="/venues" className="underline hover:text-stone-900">
                Venues page
              </Link>
              {" "}— jot down notes, photos, and pricing as you scout.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {shortlist.map((v) => (
              <DashboardVenueCard key={v.id} venue={v} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">{label}</div>
      <div className="mb-1 mt-2 font-serif text-2xl font-light leading-none md:text-3xl">{value}</div>
      <div className="text-xs text-stone-500">{sub}</div>
    </div>
  );
}

const TONE_BULLET: Record<ActivityTone, string> = {
  rose: "bg-rose-600",
  amber: "bg-amber-500",
  emerald: "bg-emerald-600",
  stone: "bg-stone-400",
};

function ActivityItem({
  label,
  sub,
  tone = "rose",
}: {
  label: string;
  sub: string;
  tone?: ActivityTone;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_BULLET[tone]}`}
      />
      <div>
        <div className="text-stone-900">{label}</div>
        <div className="mt-0.5 text-xs text-stone-500">{sub}</div>
      </div>
    </li>
  );
}

function DashboardVenueCard({
  venue,
}: {
  venue: {
    id: string;
    name: string;
    address: string | null;
    hero_photo_url: string | null;
    status: string;
    capacity_min: number | null;
    capacity_max: number | null;
  };
}) {
  return (
    <Link
      href={`/venues/${venue.id}`}
      className="group block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-amber-100 via-rose-200 to-orange-300">
        {venue.hero_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={venue.hero_photo_url}
            alt={venue.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        <div className="absolute right-3 top-3">
          <Badge
            variant={STATUS_VARIANT[venue.status as keyof typeof STATUS_VARIANT]}
            className="border-white/40 bg-white/85 text-[10px] uppercase tracking-wider text-stone-800 shadow-sm backdrop-blur"
          >
            {STATUS_LABEL[venue.status as keyof typeof STATUS_LABEL]}
          </Badge>
        </div>
      </div>
      <div className="p-5">
        <h3 className="font-serif text-2xl font-medium leading-tight tracking-tight">
          {venue.name}
        </h3>
        {venue.address && (
          <div className="mt-1 flex items-center gap-1 text-sm text-stone-500">
            <MapPin className="h-3 w-3" /> {venue.address}
          </div>
        )}
        <div className="mt-4 flex items-center justify-between text-sm text-stone-600">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {venue.capacity_min ?? "?"}–{venue.capacity_max ?? "?"}
          </span>
          <span className="flex items-center gap-1 text-stone-400">
            <Camera className="h-3.5 w-3.5" />
            <span className="text-xs">photos</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
