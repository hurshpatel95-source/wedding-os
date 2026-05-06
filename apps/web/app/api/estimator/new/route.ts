import { NextRequest, NextResponse } from "next/server";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type {
  EstimateDocument,
  EstimateLine,
  EstimateSection,
} from "@/lib/estimator-types";

export const runtime = "nodejs";

interface NewEstimateBody {
  name: string;
  source_label?: string;
  cover_emoji?: string;
  guest_count: number;
  start_date: string; // ISO yyyy-mm-dd
  end_date: string;
  sangeet_venue_id: string | null;
  wedding_venue_id: string | null;
  base_template_id: string; // budget_estimates.id to clone from
}

interface VenueLite {
  id: string;
  name: string;
  hire_fee_weekend_eur: number | null;
  hire_fee_sunday_eur: number | null;
  hire_fee_weekday_eur: number | null;
}

const DAY_NAMES = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

function dateLabel(iso: string): string {
  try {
    const d = parseISO(iso);
    const dayName = DAY_NAMES[d.getDay()];
    return `${dayName} ${format(d, "MMM d, yyyy")}`;
  } catch {
    return iso;
  }
}

function pickHireFee(date: string, venue: VenueLite | null): number | null {
  if (!venue) return null;
  try {
    const d = parseISO(date);
    const dow = d.getDay();
    if (dow === 0)
      return (
        venue.hire_fee_sunday_eur ?? venue.hire_fee_weekend_eur ?? venue.hire_fee_weekday_eur ?? null
      );
    if (dow === 6)
      return (
        venue.hire_fee_weekend_eur ?? venue.hire_fee_sunday_eur ?? venue.hire_fee_weekday_eur ?? null
      );
    return (
      venue.hire_fee_weekday_eur ?? venue.hire_fee_weekend_eur ?? venue.hire_fee_sunday_eur ?? null
    );
  } catch {
    return null;
  }
}

/** Clone a template estimate, swap section labels + dates + venue hire lines. */
function transformTemplate(
  template: EstimateDocument,
  inputs: NewEstimateBody,
  sangeetVenue: VenueLite | null,
  weddingVenue: VenueLite | null,
): EstimateDocument {
  const newSections: EstimateSection[] = template.sections.map((s, sIdx) => {
    const isSangeet = sIdx === 0;
    const isWedding = sIdx === 1;
    const venue = isSangeet ? sangeetVenue : isWedding ? weddingVenue : null;
    const date = isSangeet ? inputs.start_date : isWedding ? inputs.end_date : null;
    const dLabel = date ? dateLabel(date) : s.date_label;

    const newLines: EstimateLine[] = s.lines.map((l) => {
      // For the first "hire" line in a venue section, swap the price using
      // the new venue's hire fee for that date (if available). Heuristic:
      // line label contains "hire".
      if (
        venue &&
        date &&
        /\bhire\b/i.test(l.label) &&
        !/\bvat\b/i.test(l.label) &&
        !/sgae|siae/i.test(l.label)
      ) {
        const fee = pickHireFee(date, venue);
        if (fee != null) {
          return {
            ...l,
            id: `${l.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            label: l.label.replace(/Casa Del Mar|MSL.*|Xalet.*/i, venue.name),
            astha_eur: fee,
            override_eur: null,
            evidence: l.evidence
              ? { ...l.evidence, quote: `${venue.name} day-rate hire` }
              : { quote: `${venue.name} day-rate hire` },
          };
        }
      }
      // Otherwise: clone with a fresh id but keep all template defaults.
      return {
        ...l,
        id: `${l.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        override_eur: null,
        included: l.included && !l.tbc, // re-default opt-out items as off
      };
    });

    let label = s.label;
    if (isSangeet && sangeetVenue) {
      label = `${sangeetVenue.name} — Welcome / Sangeet`;
    } else if (isWedding && weddingVenue) {
      label = `${weddingVenue.name} — Hindu Ceremony + Reception`;
    }

    let subtitle = s.subtitle;
    if (date && (isSangeet || isWedding)) {
      subtitle = `${dLabel} · ${inputs.guest_count} guests`;
    }

    return {
      ...s,
      label,
      subtitle,
      date_label: dLabel,
      guest_count: inputs.guest_count,
      lines: newLines,
    };
  });

  return { version: 1, sections: newSections };
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.workspace_id || !profile?.org_id) {
    return NextResponse.json({ error: "no workspace" }, { status: 400 });
  }

  const body = (await request.json()) as NewEstimateBody;
  if (!body.name || !body.start_date || !body.end_date || !body.guest_count) {
    return NextResponse.json(
      { error: "name, start_date, end_date, guest_count are required" },
      { status: 400 },
    );
  }
  if (!body.base_template_id) {
    return NextResponse.json(
      { error: "base_template_id is required (clone from existing estimate)" },
      { status: 400 },
    );
  }

  // Fetch the template estimate
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data:
              | {
                  sections: EstimateDocument | null;
                  baseline_total_eur: number | null;
                }
              | null;
          }>;
        };
        in?: (col: string, vals: string[]) => Promise<{ data: VenueLite[] | null }>;
      };
    };
  };

  const { data: template } = await sb
    .from("budget_estimates")
    .select("sections, baseline_total_eur")
    .eq("id", body.base_template_id)
    .maybeSingle();
  if (!template?.sections) {
    return NextResponse.json({ error: "template not found" }, { status: 404 });
  }

  // Fetch the venues
  const venueIds = [body.sangeet_venue_id, body.wedding_venue_id].filter(
    Boolean,
  ) as string[];
  let venues: VenueLite[] = [];
  if (venueIds.length > 0) {
    const { data } = await (supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          in: (col: string, vals: string[]) => Promise<{ data: VenueLite[] | null }>;
        };
      };
    })
      .from("venues")
      .select(
        "id, name, hire_fee_weekend_eur, hire_fee_sunday_eur, hire_fee_weekday_eur",
      )
      .in("id", venueIds);
    venues = data ?? [];
  }
  const sangeetVenue = venues.find((v) => v.id === body.sangeet_venue_id) ?? null;
  const weddingVenue = venues.find((v) => v.id === body.wedding_venue_id) ?? null;

  const newDoc = transformTemplate(
    template.sections,
    body,
    sangeetVenue,
    weddingVenue,
  );

  // Compute the new effective baseline from line astha_eur values
  const baseline = newDoc.sections.reduce(
    (acc, s) =>
      acc +
      s.lines.reduce(
        (a, l) =>
          a + (l.tbc || !l.included ? 0 : Number(l.astha_eur || 0)),
        0,
      ),
    0,
  );

  // Insert
  const { data: created, error } = await (supabase as unknown as {
    from: (t: string) => {
      insert: (p: Record<string, unknown>) => {
        select: (c: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  })
    .from("budget_estimates")
    .insert({
      org_id: profile.org_id,
      workspace_id: profile.workspace_id,
      name: body.name,
      source_label:
        body.source_label ?? `Custom · cloned ${new Date().toISOString().slice(0, 10)}`,
      scenario_summary: `${
        sangeetVenue ? sangeetVenue.name : "Sangeet venue TBD"
      } + ${
        weddingVenue ? weddingVenue.name : "Wedding venue TBD"
      } · ${body.guest_count} guests`,
      cover_emoji: body.cover_emoji ?? "💍",
      guest_count: body.guest_count,
      start_date: body.start_date,
      end_date: body.end_date,
      sections: newDoc,
      baseline_total_eur: baseline,
      sort_order: 99,
    })
    .select("id")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: error?.message ?? "insert failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: created.id });
}
