import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Quote as QuoteIcon, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TestimonialStatusBadge } from "@/components/admin-testimonials/status-badge";
import { TestimonialRequestButton } from "@/components/admin-testimonials/request-button";
import {
  TESTIMONIAL_STATUS_LABEL,
  type TestimonialRow,
  type TestimonialStatus,
} from "@/lib/wave2-types";

export const dynamic = "force-dynamic";

interface WorkspaceLite {
  id: string;
  name: string;
  wedding_date: string | null;
}

interface CoupleUserLite {
  email: string;
  workspace_id: string;
  role: string;
}

const FILTER_KEYS = [
  "all",
  "requested",
  "submitted",
  "published",
  "declined",
] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

export default async function AdminTestimonialsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = createClient();

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{ data: TestimonialRow[] | null }>;
      };
    };
  };

  const [{ data: testimonialsRaw }, { data: workspacesRaw }] = await Promise.all([
    sb
      .from("testimonials")
      .select(
        "id, org_id, workspace_id, couple_names, contact_email, quote, rating, photo_storage_path, status, public_token, requested_at, submitted_at, published_at, created_by, created_at, updated_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("workspaces")
      .select("id, name, wedding_date"),
  ]);

  const testimonials = (testimonialsRaw ?? []) as TestimonialRow[];
  const workspaces = (workspacesRaw ?? []) as WorkspaceLite[];

  // Pull couple user emails so the request modal can auto-fill.
  const coupleSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => Promise<{
          data: CoupleUserLite[] | null;
        }>;
      };
    };
  };
  const { data: coupleUsersRaw } = await coupleSb
    .from("users")
    .select("email, workspace_id, role")
    .eq("role", "couple");
  const coupleUsers = (coupleUsersRaw ?? []) as CoupleUserLite[];
  const emailByWorkspaceId = new Map<string, string>();
  for (const u of coupleUsers) {
    if (!emailByWorkspaceId.has(u.workspace_id)) {
      emailByWorkspaceId.set(u.workspace_id, u.email);
    }
  }

  const filterStatus = (searchParams.status ?? "all") as FilterKey;
  const filtered =
    filterStatus === "all"
      ? testimonials
      : testimonials.filter((t) => t.status === filterStatus);

  const counts: Record<FilterKey, number> = {
    all: testimonials.length,
    requested: testimonials.filter((t) => t.status === "requested").length,
    submitted: testimonials.filter((t) => t.status === "submitted").length,
    published: testimonials.filter((t) => t.status === "published").length,
    declined: testimonials.filter((t) => t.status === "declined").length,
  };

  const ratingsAll = testimonials
    .map((t) => t.rating)
    .filter((r): r is number => typeof r === "number");
  const avgRating =
    ratingsAll.length > 0
      ? ratingsAll.reduce((a, b) => a + b, 0) / ratingsAll.length
      : null;

  // Workspace candidates for the request modal — past clients (wedding_date < now)
  // bubble up first; the modal also accepts ad-hoc entries.
  const today = new Date();
  const workspaceOptions = workspaces
    .map((w) => ({
      id: w.id,
      name: w.name,
      wedding_date: w.wedding_date,
      is_past: !!w.wedding_date && new Date(w.wedding_date) < today,
      contact_email: emailByWorkspaceId.get(w.id) ?? null,
    }))
    .sort((a, b) => {
      // Past clients first, sorted by most-recent wedding_date.
      if (a.is_past !== b.is_past) return a.is_past ? -1 : 1;
      const aDate = a.wedding_date ?? "";
      const bDate = b.wedding_date ?? "";
      return bDate.localeCompare(aDate);
    });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Testimonials
          </div>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
            What couples say
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Send a one-click submission link, polish the result, then publish
            to your booking page.
          </p>
        </div>
        <TestimonialRequestButton workspaces={workspaceOptions} />
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total" value={String(counts.all)} sub="all-time" />
        <StatCard
          label="Awaiting submission"
          value={String(counts.requested)}
          tone="amber"
          sub="links sent"
        />
        <StatCard
          label="Published"
          value={String(counts.published)}
          tone="emerald"
          sub="live on booking page"
        />
        <StatCard
          label="Average rating"
          value={avgRating == null ? "—" : avgRating.toFixed(1)}
          sub={
            avgRating == null
              ? "no ratings yet"
              : `${ratingsAll.length} rating${ratingsAll.length === 1 ? "" : "s"}`
          }
        />
      </section>

      <FilterBar current={filterStatus} counts={counts} />

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <QuoteIcon className="mx-auto mb-3 h-8 w-8 text-stone-300" />
            <h3 className="font-serif text-xl font-light text-stone-800">
              No testimonials in this view
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-stone-500">
              Send a request to a recent couple — you&rsquo;ll have a stack of
              social proof in no time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/60 text-[10px] uppercase tracking-[0.2em] text-stone-500">
                <th className="px-4 py-3 text-left">Couple</th>
                <th className="px-4 py-3 text-left">Quote</th>
                <th className="w-24 px-4 py-3 text-left">Rating</th>
                <th className="w-28 px-4 py-3 text-left">Status</th>
                <th className="w-28 px-4 py-3 text-left">Requested</th>
                <th className="w-28 px-4 py-3 text-left">Published</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-stone-50/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/testimonials/${t.id}`}
                      className="font-medium text-stone-900 hover:underline"
                    >
                      {t.couple_names ?? "Unnamed couple"}
                    </Link>
                    {t.contact_email && (
                      <div className="text-[11px] text-stone-500">
                        {t.contact_email}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-700">
                    {t.quote ? (
                      <span className="line-clamp-2 italic text-stone-600">
                        &ldquo;{truncate(t.quote, 140)}&rdquo;
                      </span>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {t.rating != null ? (
                      <StarRow rating={t.rating} />
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <TestimonialStatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500">
                    {t.requested_at ? formatRelative(t.requested_at) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500">
                    {t.published_at ? formatRelative(t.published_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max).trimEnd()}…`;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i <= rating
              ? "fill-amber-400 text-amber-400"
              : "fill-stone-200 text-stone-200"
          }`}
        />
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "rose" | "amber" | "emerald";
}) {
  const toneCls =
    tone === "rose"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : tone === "emerald"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-stone-200 bg-white";
  return (
    <div className={`rounded-2xl border ${toneCls} p-4`}>
      <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">
        {label}
      </div>
      <div className="mt-1 font-serif text-3xl font-medium tabular-nums">
        {value}
      </div>
      {sub && (
        <div className="text-[10px] uppercase tracking-wider opacity-60">
          {sub}
        </div>
      )}
    </div>
  );
}

function FilterBar({
  current,
  counts,
}: {
  current: FilterKey;
  counts: Record<FilterKey, number>;
}) {
  const tabs: FilterKey[] = [
    "all",
    "requested",
    "submitted",
    "published",
    "declined",
  ];
  return (
    <nav className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const active = current === t;
        const label =
          t === "all" ? "All" : TESTIMONIAL_STATUS_LABEL[t as TestimonialStatus];
        return (
          <Link
            key={t}
            href={t === "all" ? "/admin/testimonials" : `/admin/testimonials?status=${t}`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              active
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
            }`}
          >
            {label}
            <Badge
              variant="secondary"
              className="ml-1 bg-stone-100 px-1.5 py-0 text-[9px] text-stone-700"
            >
              {counts[t] ?? 0}
            </Badge>
          </Link>
        );
      })}
    </nav>
  );
}

function formatRelative(iso: string): string {
  const dt = new Date(iso).getTime();
  const now = Date.now();
  const diff = dt - now;
  const abs = Math.abs(diff);
  if (abs < 60 * 1000) return diff < 0 ? "just now" : "in seconds";
  if (abs < 60 * 60 * 1000) {
    const mins = Math.round(abs / (1000 * 60));
    return diff < 0 ? `${mins}m ago` : `in ${mins}m`;
  }
  if (abs < 24 * 60 * 60 * 1000) {
    const hrs = Math.round(abs / (1000 * 60 * 60));
    return diff < 0 ? `${hrs}h ago` : `in ${hrs}h`;
  }
  if (abs < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.round(abs / (1000 * 60 * 60 * 24));
    return diff < 0 ? `${days}d ago` : `in ${days}d`;
  }
  try {
    return format(parseISO(iso), "MMM d");
  } catch {
    return iso.slice(0, 10);
  }
}
