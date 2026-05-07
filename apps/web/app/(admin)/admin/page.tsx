import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Inbox,
  Library,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { LeadStatusBadge } from "@/components/admin-leads/lead-status-badge";
import {
  LEAD_SOURCE_LABEL,
  type LeadRow,
  type MarketingScorecardRow,
  type OrgPublicRow,
} from "@/lib/lead-types";

export const dynamic = "force-dynamic";

interface InvoiceRow {
  id: string;
  workspace_id: string;
  amount_eur: number;
  due_at: string | null;
  paid_at: string | null;
  created_at: string;
}

interface PlanningTaskRow {
  id: string;
  workspace_id: string;
  status: string;
  due_date: string | null;
}

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams?: { welcome?: string };
}) {
  const supabase = createClient();
  const welcomeJustDone = searchParams?.welcome === "done";

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => Promise<{
        data: Array<Record<string, unknown>> | null;
      }>;
    };
  };

  // Fan-out fetch — RLS scopes everything to the org_admin's org.
  const [
    { data: workspacesRaw },
    { data: invoicesRaw },
    { data: leadsRaw },
    { data: planningTasksRaw },
    { data: scorecardsRaw },
    { data: librarySizeRaw },
  ] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, name, wedding_date, created_at, public_slug, public_published_at"),
    sb
      .from("planner_invoices")
      .select("id, workspace_id, amount_eur, due_at, paid_at, created_at"),
    sb
      .from("leads")
      .select(
        "id, source, status, couple_names, partner_a_name, partner_b_name, email, phone, wedding_date, guest_count, budget_band, scheduled_call_at, scheduled_call_duration_minutes, converted_workspace_id, converted_at, referring_workspace_id, created_at, updated_at",
      ),
    sb.from("planning_tasks").select("id, workspace_id, status, due_date"),
    sb
      .from("marketing_scorecards")
      .select(
        "id, org_id, url, title_text, meta_description, h1_count, word_count, has_call_to_action, has_contact_info, has_schema_org, page_speed_seconds, scorecard_md, recommendations, raw_excerpt, fetched_at, created_at",
      ),
    sb.from("library_venues").select("id"),
  ]);

  const workspaces = (workspacesRaw ?? []) as Array<{
    id: string;
    name: string;
    wedding_date: string | null;
    created_at: string;
    public_slug: string | null;
    public_published_at: string | null;
  }>;
  const invoices = (invoicesRaw ?? []) as unknown as InvoiceRow[];
  const leads = (leadsRaw ?? []) as unknown as LeadRow[];
  const planningTasks = (planningTasksRaw ?? []) as unknown as PlanningTaskRow[];
  const scorecards = (scorecardsRaw ?? []) as unknown as MarketingScorecardRow[];
  const librarySize = (librarySizeRaw ?? []).length;

  // Fetch the org row for booking-page status
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let org: OrgPublicRow | null = null;
  if (user) {
    const profileSb = supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: { org_id?: string | null } | null;
            }>;
          };
        };
      };
    };
    const { data: profile } = await profileSb
      .from("users")
      .select("org_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.org_id) {
      const { data: orgRow } = await (
        supabase as unknown as {
          from: (t: string) => {
            select: (cols: string) => {
              eq: (col: string, val: string) => {
                maybeSingle: () => Promise<{ data: OrgPublicRow | null }>;
              };
            };
          };
        }
      )
        .from("organizations")
        .select(
          "id, name, public_slug, public_tagline, public_brand_md, public_hero_storage_path, contact_phone, contact_email, booking_buffer_minutes, booking_slot_minutes, public_published_at",
        )
        .eq("id", profile.org_id)
        .maybeSingle();
      org = orgRow ?? null;
    }
  }

  // First-time-planner redirect: a brand-new org has nothing published, no
  // library, and the planner hasn't seen the welcome wizard yet. We send
  // them through onboarding before showing them an empty dashboard.
  // Skip the redirect when ?welcome=done so we don't trap the user in a
  // loop on completion (they'll be empty for a moment then populate as
  // they actually use the product).
  if (
    !welcomeJustDone &&
    org &&
    !org.public_published_at &&
    librarySize === 0
  ) {
    redirect("/admin/welcome");
  }

  const now = Date.now();
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();

  // Revenue
  let revenueYtd = 0;
  let outstanding = 0;
  let overdue = 0;
  for (const inv of invoices) {
    const amt = Number(inv.amount_eur);
    if (inv.paid_at) {
      if (new Date(inv.paid_at).getTime() >= yearStart) revenueYtd += amt;
    } else {
      outstanding += amt;
      if (inv.due_at && new Date(inv.due_at).getTime() < now) overdue += amt;
    }
  }

  // Active clients
  let activeClients = 0;
  for (const w of workspaces) {
    if (w.wedding_date && new Date(w.wedding_date).getTime() >= now) activeClients++;
  }

  // Leads — funnel + recent + upcoming calls
  const last30 = now - 30 * 24 * 60 * 60 * 1000;
  const leads30 = leads.filter((l) => new Date(l.created_at).getTime() >= last30);
  const newLeads = leads.filter((l) => l.status === "new");
  const upcomingCalls = leads
    .filter(
      (l) =>
        l.scheduled_call_at &&
        new Date(l.scheduled_call_at).getTime() > now &&
        new Date(l.scheduled_call_at).getTime() < now + 14 * 24 * 60 * 60 * 1000,
    )
    .sort(
      (a, b) =>
        new Date(a.scheduled_call_at!).getTime() -
        new Date(b.scheduled_call_at!).getTime(),
    );

  const recentLeads = [...leads]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 6);

  const conversions30 = leads30.filter((l) => !!l.converted_at).length;
  const convRate30 =
    leads30.length > 0 ? Math.round((conversions30 / leads30.length) * 100) : 0;

  // Tasks needing attention
  const openTasks = planningTasks.filter(
    (t) => t.status !== "done" && t.status !== "na",
  );
  const overdueTasks = openTasks.filter(
    (t) => t.due_date && new Date(t.due_date).getTime() < now,
  );
  const dueSoonTasks = openTasks.filter(
    (t) =>
      t.due_date &&
      new Date(t.due_date).getTime() >= now &&
      new Date(t.due_date).getTime() < now + 7 * 24 * 60 * 60 * 1000,
  );

  // Workspaces by upcoming wedding
  const upcomingWeddings = workspaces
    .filter((w) => w.wedding_date && new Date(w.wedding_date).getTime() >= now)
    .sort(
      (a, b) =>
        new Date(a.wedding_date!).getTime() -
        new Date(b.wedding_date!).getTime(),
    )
    .slice(0, 5);

  // Marketing scorecard
  const latestScorecard = scorecards.sort(
    (a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime(),
  )[0];

  // Booking page state
  const bookingLive = !!org?.public_published_at && !!org?.public_slug;
  const bookingUrl = bookingLive ? `/book/${org!.public_slug}` : null;

  const wsById = new Map(workspaces.map((w) => [w.id, w]));

  return (
    <div className="space-y-6">
      {welcomeJustDone && (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-rose-50 to-amber-50 px-5 py-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-xl" aria-hidden>
              🎉
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-base font-medium text-emerald-900">
                Studio set up. Here&rsquo;s your live dashboard.
              </p>
              <p className="mt-0.5 text-xs text-emerald-800/80">
                You can revisit any onboarding step later from{" "}
                <Link
                  href="/admin/welcome"
                  className="underline hover:no-underline"
                >
                  /admin/welcome
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Studio dashboard
          </div>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
            Welcome back, {org?.name ?? "Studio"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Today at a glance — leads in flight, calls coming up, what your
            clients need from you next.
          </p>
        </div>
        {bookingUrl && (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 transition hover:border-rose-500 hover:text-rose-800"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Booking page live
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </header>

      {/* Top stats — the money signals */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <BigStat
          label="Revenue YTD"
          value={`€${formatK(revenueYtd)}`}
          sub={`${invoices.filter((i) => !!i.paid_at).length} invoices paid`}
          tone="emerald"
        />
        <BigStat
          label="Outstanding"
          value={`€${formatK(outstanding)}`}
          sub={overdue > 0 ? `€${formatK(overdue)} overdue` : "all on track"}
          tone={overdue > 0 ? "amber" : "stone"}
        />
        <BigStat
          label="Active clients"
          value={String(activeClients)}
          sub={`${workspaces.length} total`}
          tone="rose"
        />
        <BigStat
          label="New leads · 30d"
          value={String(leads30.length)}
          sub={`${convRate30}% converted`}
          tone="rose"
        />
        <BigStat
          label="Upcoming calls"
          value={String(upcomingCalls.length)}
          sub="next 14 days"
          tone="amber"
        />
      </section>

      {/* Two-column: lead activity + upcoming calls */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {/* Recent lead activity stream */}
        <Card>
          <CardContent className="py-5">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-rose-600" />
                <h3 className="font-serif text-xl">Recent leads</h3>
              </div>
              <Link
                href="/admin/leads"
                className="text-[11px] text-stone-500 underline hover:text-stone-900"
              >
                See all →
              </Link>
            </div>

            {newLeads.length > 0 && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-rose-900">
                    {newLeads.length} new lead{newLeads.length === 1 ? "" : "s"} awaiting reply
                  </span>
                  <Link
                    href="/admin/leads?status=new"
                    className="inline-flex items-center gap-1 text-xs font-medium text-rose-900 hover:underline"
                  >
                    Reply now
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )}

            {recentLeads.length === 0 ? (
              <div className="mt-4 rounded-md border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500">
                No leads yet. Share <code className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px]">{bookingUrl ?? "/book/<your-slug>"}</code> on Instagram and your contact form.
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-stone-100">
                {recentLeads.map((l) => {
                  const name =
                    l.couple_names ||
                    [l.partner_a_name, l.partner_b_name].filter(Boolean).join(" & ") ||
                    "Unnamed";
                  const referrer = l.referring_workspace_id
                    ? wsById.get(l.referring_workspace_id)?.name ?? null
                    : null;
                  return (
                    <li key={l.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/admin/leads/${l.id}`}
                            className="font-medium text-stone-900 hover:underline"
                          >
                            {name}
                          </Link>
                          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-stone-500">
                            <span>{LEAD_SOURCE_LABEL[l.source]}</span>
                            {referrer && (
                              <span className="text-stone-400">via {referrer}</span>
                            )}
                            {l.budget_band && <span>· {l.budget_band}</span>}
                            {l.guest_count && <span>· {l.guest_count} guests</span>}
                            {l.wedding_date && (
                              <span>· {format(parseISO(l.wedding_date), "MMM yyyy")}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <LeadStatusBadge status={l.status} />
                          <span className="text-[10px] text-stone-400">
                            {relTime(l.created_at)}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Upcoming calls */}
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-amber-600" />
              <h3 className="font-serif text-xl">Upcoming calls</h3>
            </div>
            {upcomingCalls.length === 0 ? (
              <div className="mt-4 rounded-md border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500">
                No calls booked. Slots open up at{" "}
                <Link href="/admin/booking" className="underline">
                  /admin/booking
                </Link>
                .
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {upcomingCalls.slice(0, 5).map((l) => {
                  const dt = new Date(l.scheduled_call_at!);
                  const name =
                    l.couple_names ||
                    [l.partner_a_name, l.partner_b_name].filter(Boolean).join(" & ") ||
                    "Unnamed";
                  const isToday =
                    dt.toDateString() === new Date().toDateString();
                  return (
                    <li
                      key={l.id}
                      className={`rounded-lg border p-3 transition hover:border-amber-400 ${
                        isToday
                          ? "border-amber-300 bg-amber-50/60"
                          : "border-stone-200 bg-white"
                      }`}
                    >
                      <Link href={`/admin/leads/${l.id}`} className="block">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-medium text-stone-900">{name}</span>
                          <span className="text-[10px] uppercase tracking-wider text-amber-700">
                            {isToday ? "today" : format(dt, "EEE MMM d")}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-500">
                          {format(dt, "h:mm a")} ·{" "}
                          {l.scheduled_call_duration_minutes ?? 30} min
                          {l.budget_band && (
                            <span className="text-stone-400"> · {l.budget_band}</span>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Three-column: tasks / weddings / studio health */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Tasks needing attention */}
        <Card>
          <CardContent className="py-5">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                <Inbox className="h-4 w-4 text-rose-600" />
                <h3 className="font-serif text-lg">Inbox</h3>
              </div>
              <Link
                href="/admin/inbox"
                className="text-[11px] text-stone-500 underline hover:text-stone-900"
              >
                Open →
              </Link>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center justify-between rounded-md bg-stone-50/60 px-3 py-2">
                <span className="text-stone-700">Overdue</span>
                <span
                  className={`font-serif text-xl font-medium tabular-nums ${
                    overdueTasks.length > 0 ? "text-rose-700" : "text-stone-400"
                  }`}
                >
                  {overdueTasks.length}
                </span>
              </li>
              <li className="flex items-center justify-between rounded-md bg-stone-50/60 px-3 py-2">
                <span className="text-stone-700">Due in 7 days</span>
                <span
                  className={`font-serif text-xl font-medium tabular-nums ${
                    dueSoonTasks.length > 0 ? "text-amber-700" : "text-stone-400"
                  }`}
                >
                  {dueSoonTasks.length}
                </span>
              </li>
              <li className="flex items-center justify-between rounded-md bg-stone-50/60 px-3 py-2">
                <span className="text-stone-700">Open total</span>
                <span className="font-serif text-xl font-medium tabular-nums text-stone-700">
                  {openTasks.length}
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Upcoming weddings */}
        <Card>
          <CardContent className="py-5">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-rose-600" />
                <h3 className="font-serif text-lg">Upcoming weddings</h3>
              </div>
              <Link
                href="/admin/clients"
                className="text-[11px] text-stone-500 underline hover:text-stone-900"
              >
                All clients →
              </Link>
            </div>
            {upcomingWeddings.length === 0 ? (
              <p className="mt-3 text-sm text-stone-500">
                No upcoming weddings.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {upcomingWeddings.map((w) => {
                  const dt = new Date(w.wedding_date!);
                  const days = Math.round((dt.getTime() - now) / (1000 * 60 * 60 * 24));
                  return (
                    <li key={w.id}>
                      <Link
                        href={`/admin/clients/${w.id}`}
                        className="flex items-center justify-between rounded-md bg-stone-50/60 px-3 py-2 text-sm transition hover:bg-stone-100"
                      >
                        <span className="line-clamp-1 font-medium">
                          {w.name.split("—")[0].trim()}
                        </span>
                        <span
                          className={`shrink-0 text-[10px] uppercase tracking-wider ${
                            days <= 60
                              ? "text-amber-700"
                              : days <= 180
                                ? "text-stone-600"
                                : "text-stone-400"
                          }`}
                        >
                          {days}d
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Studio health */}
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-2">
              <Library className="h-4 w-4 text-stone-700" />
              <h3 className="font-serif text-lg">Studio</h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center justify-between rounded-md bg-stone-50/60 px-3 py-2">
                <span className="text-stone-700">Library venues</span>
                <span className="font-medium tabular-nums">{librarySize}</span>
              </li>
              <li className="flex items-center justify-between rounded-md bg-stone-50/60 px-3 py-2">
                <span className="text-stone-700">Booking page</span>
                {bookingLive ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Live
                  </span>
                ) : (
                  <Link
                    href="/admin/booking"
                    className="text-xs text-rose-700 underline"
                  >
                    Set up →
                  </Link>
                )}
              </li>
              <li className="flex items-center justify-between rounded-md bg-stone-50/60 px-3 py-2">
                <span className="text-stone-700">Public sites</span>
                <span className="font-medium tabular-nums">
                  {workspaces.filter((w) => w.public_published_at).length}
                </span>
              </li>
              <li className="flex items-center justify-between rounded-md bg-stone-50/60 px-3 py-2">
                <span className="text-stone-700">Marketing scorecard</span>
                {latestScorecard ? (
                  <Link
                    href="/admin/marketing"
                    className="text-xs text-stone-700 underline"
                  >
                    {format(parseISO(latestScorecard.fetched_at), "MMM d")}
                  </Link>
                ) : (
                  <Link
                    href="/admin/marketing"
                    className="text-xs text-rose-700 underline"
                  >
                    Run →
                  </Link>
                )}
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Marketing scorecard top picks */}
      {latestScorecard && latestScorecard.recommendations.length > 0 && (
        <Card>
          <CardContent className="py-5">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-rose-600" />
                <h3 className="font-serif text-xl">
                  What to fix on your website
                </h3>
              </div>
              <Link
                href="/admin/marketing"
                className="text-[11px] text-stone-500 underline hover:text-stone-900"
              >
                Full scorecard →
              </Link>
            </div>
            <ol className="mt-4 space-y-2">
              {latestScorecard.recommendations.slice(0, 3).map((r, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-stone-100 bg-stone-50/40 p-3"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 font-serif text-xs text-rose-700">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className="font-serif text-base font-medium text-stone-900">
                        {r.title}
                      </h4>
                      <EffortPill effort={r.effort} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-stone-700">
                      {r.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BigStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "emerald" | "amber" | "rose" | "stone";
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : tone === "rose"
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : "border-stone-200 bg-white";
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">
        {label}
      </div>
      <div className="mt-1 font-serif text-2xl font-medium tabular-nums leading-tight md:text-3xl">
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.15em] opacity-70">
        {sub}
      </div>
    </div>
  );
}

function EffortPill({ effort }: { effort: "low" | "medium" | "high" }) {
  const cls =
    effort === "low"
      ? "bg-emerald-100 text-emerald-800"
      : effort === "medium"
        ? "bg-amber-100 text-amber-800"
        : "bg-rose-100 text-rose-800";
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${cls}`}
    >
      {effort} effort
    </span>
  );
}

function formatK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return Math.round(n).toLocaleString();
}

function relTime(iso: string): string {
  const dt = new Date(iso).getTime();
  const diff = Date.now() - dt;
  const mins = Math.round(diff / 60000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}
