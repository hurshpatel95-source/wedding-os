import { format, parseISO } from "date-fns";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/server";
import { ScorecardForm } from "@/components/admin-marketing/scorecard-form";
import type { MarketingScorecardRow } from "@/lib/lead-types";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

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
  const orgId = profile?.org_id ?? null;

  let scorecards: MarketingScorecardRow[] = [];
  if (orgId) {
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (col: string, val: string) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => {
                limit: (n: number) => Promise<{
                  data: MarketingScorecardRow[] | null;
                }>;
              };
            };
          };
        };
      }
    )
      .from("marketing_scorecards")
      .select(
        "id, org_id, url, title_text, meta_description, h1_count, word_count, has_call_to_action, has_contact_info, has_schema_org, page_speed_seconds, scorecard_md, recommendations, raw_excerpt, fetched_at, created_at",
      )
      .eq("org_id", orgId)
      .order("fetched_at", { ascending: false })
      .limit(20);
    scorecards = (data ?? []) as MarketingScorecardRow[];
  }

  const latest = scorecards[0] ?? null;

  return (
    <div className="space-y-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Marketing & SEO
        </div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
          Get found by couples
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Run our marketing scorecard against your website. We pull the page,
          analyze title + meta + content + structure, and Claude returns a
          prioritized action list — what to fix first, what&rsquo;s already
          working, and what&rsquo;s costing you leads.
        </p>
      </header>

      <ScorecardForm initialUrl={latest?.url ?? ""} />

      {latest && (
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                Latest scorecard
              </div>
              <div className="mt-1 flex items-center gap-3">
                <a
                  href={latest.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-serif text-2xl font-light tracking-tight text-stone-900 hover:underline"
                >
                  {prettyUrl(latest.url)}
                </a>
                <ExternalLink className="h-4 w-4 text-stone-400" />
              </div>
              <div className="mt-1 text-[11px] text-stone-500">
                Pulled {format(parseISO(latest.fetched_at), "MMM d, yyyy h:mm a")}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label="Title length"
              value={
                latest.title_text
                  ? `${latest.title_text.length} chars`
                  : "—"
              }
              ok={
                latest.title_text != null &&
                latest.title_text.length >= 30 &&
                latest.title_text.length <= 65
              }
            />
            <Stat
              label="Meta desc."
              value={
                latest.meta_description
                  ? `${latest.meta_description.length} chars`
                  : "—"
              }
              ok={
                latest.meta_description != null &&
                latest.meta_description.length >= 80 &&
                latest.meta_description.length <= 160
              }
            />
            <Stat
              label="H1 count"
              value={String(latest.h1_count ?? 0)}
              ok={latest.h1_count === 1}
            />
            <Stat
              label="Word count"
              value={String(latest.word_count ?? 0)}
              ok={(latest.word_count ?? 0) >= 300}
            />
            <Stat
              label="CTA"
              value={latest.has_call_to_action ? "Found" : "Missing"}
              ok={!!latest.has_call_to_action}
            />
            <Stat
              label="Contact info"
              value={latest.has_contact_info ? "Found" : "Missing"}
              ok={!!latest.has_contact_info}
            />
            <Stat
              label="Schema.org"
              value={latest.has_schema_org ? "Found" : "Missing"}
              ok={!!latest.has_schema_org}
            />
            <Stat
              label="Load time"
              value={
                latest.page_speed_seconds != null
                  ? `${latest.page_speed_seconds.toFixed(2)}s`
                  : "—"
              }
              ok={
                latest.page_speed_seconds != null &&
                latest.page_speed_seconds < 3
              }
            />
          </div>

          {latest.recommendations.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-stone-500">
                <TrendingUp className="h-3 w-3" />
                Top recommendations
              </div>
              <ol className="mt-3 space-y-3">
                {latest.recommendations.map((r, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-stone-100 bg-stone-50/40 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 font-serif text-sm text-rose-700">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h4 className="font-serif text-base font-medium text-stone-900">
                            {r.title}
                          </h4>
                          <EffortPill effort={r.effort} />
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-stone-700">
                          {r.detail}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {latest.scorecard_md && (
            <div className="mt-8 rounded-xl border border-stone-200 bg-stone-50/30 p-5">
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                Full report
              </div>
              <div className="markdown-body mt-3 space-y-3 text-sm leading-relaxed text-stone-800 [&_a]:text-rose-700 [&_a]:underline [&_h2]:mt-5 [&_h2]:font-serif [&_h2]:text-lg [&_h3]:mt-4 [&_h3]:font-serif [&_h3]:text-base [&_li]:my-1 [&_p]:my-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {latest.scorecard_md}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </section>
      )}

      {scorecards.length > 1 && (
        <section>
          <h2 className="mb-3 text-[10px] uppercase tracking-[0.2em] text-stone-500">
            History
          </h2>
          <ul className="space-y-2">
            {scorecards.slice(1).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-md border border-stone-200 bg-white px-4 py-2 text-sm"
              >
                <span className="truncate text-stone-700">{prettyUrl(s.url)}</span>
                <span className="text-[11px] text-stone-500">
                  {format(parseISO(s.fetched_at), "MMM d · h:mma")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {scorecards.length === 0 && (
        <section className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-8 py-12 text-center">
          <p className="text-sm text-stone-500">
            Run your first scorecard above. Try your studio&rsquo;s home page.
          </p>
          <Link
            href="/admin/booking"
            className="mt-3 inline-flex items-center gap-1 text-xs text-stone-700 underline"
          >
            Or set up your booking page first →
          </Link>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        ok ? "border-emerald-200 bg-emerald-50/40" : "border-stone-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
          {label}
        </span>
        {ok ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
        )}
      </div>
      <div className="mt-1 font-serif text-lg font-medium tabular-nums">
        {value}
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

function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.host + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return url;
  }
}
