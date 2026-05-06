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
  hire_fee_friday_eur: number | null;
  minimum_pax_weekend: number | null;
  minimum_pax_sunday: number | null;
  minimum_pax_weekday: number | null;
  shortfall_per_pax_eur: number | null;
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

function dayShort(iso: string): string {
  try {
    const d = parseISO(iso);
    return DAY_NAMES[d.getDay()];
  } catch {
    return "";
  }
}

function dateLabel(iso: string): string {
  try {
    const d = parseISO(iso);
    return `${DAY_NAMES[d.getDay()]} ${format(d, "MMM d, yyyy")}`;
  } catch {
    return iso;
  }
}

function pickHireFee(
  date: string,
  venue: VenueLite | null,
): { fee: number | null; matched: boolean } {
  if (!venue) return { fee: null, matched: false };
  try {
    const d = parseISO(date);
    const dow = d.getDay();
    // Sun
    if (dow === 0) {
      if (venue.hire_fee_sunday_eur != null)
        return { fee: Number(venue.hire_fee_sunday_eur), matched: true };
    }
    // Sat
    if (dow === 6) {
      if (venue.hire_fee_weekend_eur != null)
        return { fee: Number(venue.hire_fee_weekend_eur), matched: true };
    }
    // Fri
    if (dow === 5) {
      if (venue.hire_fee_friday_eur != null)
        return { fee: Number(venue.hire_fee_friday_eur), matched: true };
    }
    // Fall back to weekday for Mon-Thu (and Fri/Sat/Sun if their slot is null)
    if (venue.hire_fee_weekday_eur != null)
      return { fee: Number(venue.hire_fee_weekday_eur), matched: false };
    return { fee: null, matched: false };
  } catch {
    return { fee: null, matched: false };
  }
}

/** When the venue charges per-day-of-week minimums, compute any shortfall
 * for the booking and return a synthetic line item. Currently models MSL's
 * Saturday-only premium (min 280 guests × shortfall_per_pax). Returns null
 * if no shortfall applies. */
function shortfallLine(
  date: string,
  guestCount: number,
  venue: VenueLite | null,
  prefix: string,
): EstimateLine | null {
  if (!venue || !venue.shortfall_per_pax_eur) return null;
  const perPax = Number(venue.shortfall_per_pax_eur);
  if (!perPax) return null;
  let dow: number;
  try {
    dow = parseISO(date).getDay();
  } catch {
    return null;
  }
  let minimum: number | null = null;
  let dayWord = "";
  if (dow === 0 && venue.minimum_pax_sunday) {
    minimum = venue.minimum_pax_sunday;
    dayWord = "Sun";
  } else if (dow === 6 && venue.minimum_pax_weekend) {
    minimum = venue.minimum_pax_weekend;
    dayWord = "Sat";
  } else if (
    dow >= 1 &&
    dow <= 5 &&
    venue.minimum_pax_weekday
  ) {
    minimum = venue.minimum_pax_weekday;
    dayWord = "weekday";
  }
  if (!minimum || guestCount >= minimum) return null;

  const gap = minimum - guestCount;
  const total = gap * perPax;
  return {
    id: `${prefix}-shortfall-${Date.now()}`,
    label: `${venue.name} ${dayWord} guest-count shortfall`,
    unit_label: `${gap} pax × €${perPax}`,
    unit: "per_guest",
    qty: gap,
    unit_price_eur: perPax,
    astha_eur: total,
    override_eur: null,
    included: true,
    notes: `Auto-calculated: ${venue.name} ${dayWord} minimum is ${minimum} guests, you're at ${guestCount}.`,
    user_added: false,
    evidence: {
      quote: `${venue.name} ${dayWord} minimum spend ${minimum} pax (€${perPax}/pax shortfall)`,
    },
  };
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
      // For the first "hire" line in a venue section, swap the price + unit
      // label using the new venue's hire fee for that date (if available).
      // Heuristic: line label contains "hire". Skip VAT and SGAE/SIAE lines.
      if (
        venue &&
        date &&
        /\bhire\b/i.test(l.label) &&
        !/\bvat\b/i.test(l.label) &&
        !/sgae|siae/i.test(l.label)
      ) {
        const { fee, matched } = pickHireFee(date, venue);
        const day = dayShort(date);
        const newUnitLabel = matched
          ? `flat (${day})`
          : `flat (${day} · est)`;
        if (fee != null) {
          return {
            ...l,
            id: `${l.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            label: `${venue.name} venue hire`,
            unit_label: newUnitLabel,
            astha_eur: fee,
            override_eur: null,
            evidence: matched
              ? { quote: `${venue.name} day-rate hire (${day})` }
              : {
                  quote: `${venue.name} ${day} rate not set — using weekday fallback`,
                },
          };
        }
        // No fee set on venue at all — leave the template's price but flag
        return {
          ...l,
          id: `${l.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          label: `${venue.name} venue hire`,
          unit_label: `flat (${day} · template carry-over)`,
          override_eur: null,
        };
      }
      // Otherwise: clone with a fresh id but keep all template defaults.
      return {
        ...l,
        id: `${l.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        override_eur: null,
        included: l.included && !l.tbc, // re-default opt-out items as off
      };
    });

    // Auto-inject minimum-spend shortfall line if the venue has one for
    // this day-of-week and the guest count is below it.
    if (venue && date) {
      const sl = shortfallLine(date, inputs.guest_count, venue, s.id);
      if (sl) {
        // Insert AFTER the venue-hire/SGAE/VAT block — find the last
        // "venue hire" / "SGAE" / "VAT" line and splice in there.
        const lastBlockIdx = (() => {
          let idx = -1;
          for (let i = 0; i < newLines.length; i += 1) {
            const lbl = newLines[i].label.toLowerCase();
            if (
              lbl.includes("hire") ||
              lbl.includes("sgae") ||
              lbl.includes("siae") ||
              lbl.includes("vat")
            )
              idx = i;
          }
          return idx;
        })();
        if (lastBlockIdx >= 0) {
          newLines.splice(lastBlockIdx + 1, 0, sl);
        } else {
          newLines.unshift(sl);
        }
      }
    }

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
        "id, name, hire_fee_weekend_eur, hire_fee_sunday_eur, hire_fee_weekday_eur, hire_fee_friday_eur, minimum_pax_weekend, minimum_pax_sunday, minimum_pax_weekday, shortfall_per_pax_eur",
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
