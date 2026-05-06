import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { EVENT_ROLES, EVENT_ROLE_LABEL } from "@/lib/event-roles";
import { TimelinePrintAuto } from "@/components/timeline/timeline-print-auto";
import type { Database } from "@wedding-os/db";

export const dynamic = "force-dynamic";

type TimelineItem = Database["public"]["Tables"]["timeline_items"]["Row"];
type EventRole = Database["public"]["Enums"]["event_role"];

const fmtTime = (iso: string | null) => {
  if (!iso) return "TBD";
  try {
    return format(parseISO(iso), "p");
  } catch {
    return "TBD";
  }
};

export default async function TimelinePrintPage() {
  const supabase = createClient();

  const [{ data: items }, { data: workspace }] = await Promise.all([
    supabase
      .from("timeline_items")
      .select(
        "id, workspace_id, org_id, event_role, occurs_at, duration_minutes, what, who_responsible, location, vendor_id, notes, sort_order, created_by, created_at, updated_at",
      )
      .order("event_role", { ascending: true })
      .order("occurs_at", { ascending: true, nullsFirst: false })
      .order("sort_order", { ascending: true }),
    supabase
      .from("workspaces")
      .select("name, wedding_date")
      .limit(1)
      .maybeSingle(),
  ]);

  const grouped = new Map<EventRole, TimelineItem[]>();
  for (const it of (items ?? []) as TimelineItem[]) {
    const list = grouped.get(it.event_role) ?? [];
    list.push(it);
    grouped.set(it.event_role, list);
  }

  const dateLabel = workspace?.wedding_date
    ? (() => {
        try {
          return format(parseISO(workspace.wedding_date as string), "PPPP");
        } catch {
          return null;
        }
      })()
    : null;

  return (
    <div className="space-y-6 print:p-0">
      <TimelinePrintAuto />

      {/* Header chrome — visible on screen, hidden on print */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-serif text-3xl">Run of show — print preview</h1>
          <p className="text-sm text-muted-foreground">
            Use your browser's Print dialog (Cmd/Ctrl+P) to save as PDF.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-stone-900 px-4 text-sm font-medium text-white hover:bg-stone-800"
          // Inline onClick via data-print attribute handled by TimelinePrintAuto
          data-print-trigger="true"
        >
          Print this page
        </button>
      </div>

      {/* Printable document */}
      <article className="mx-auto max-w-3xl bg-white p-8 text-stone-900 shadow print:m-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="mb-8 border-b border-stone-300 pb-4">
          <h1 className="font-serif text-3xl">
            {workspace?.name ?? "Wedding"} — Run of Show
          </h1>
          {dateLabel && (
            <p className="mt-2 text-sm uppercase tracking-[0.15em] text-stone-500">
              {dateLabel}
            </p>
          )}
        </header>

        {grouped.size === 0 ? (
          <p className="text-sm text-stone-500">No timeline items yet.</p>
        ) : (
          <div className="space-y-8">
            {EVENT_ROLES.filter((r) => grouped.has(r)).map((r) => (
              <section key={r} className="break-inside-avoid">
                <h2 className="mb-2 font-serif text-2xl">{EVENT_ROLE_LABEL[r]}</h2>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-stone-300 text-left text-[10px] uppercase tracking-[0.15em] text-stone-500">
                      <th className="py-2 pr-3 font-normal">Time</th>
                      <th className="py-2 pr-3 font-normal">Dur.</th>
                      <th className="py-2 pr-3 font-normal">What</th>
                      <th className="py-2 pr-3 font-normal">Who</th>
                      <th className="py-2 pr-3 font-normal">Location</th>
                      <th className="py-2 font-normal">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(grouped.get(r) ?? []).map((it) => (
                      <tr
                        key={it.id}
                        className="border-b border-stone-200 align-top"
                      >
                        <td className="py-2 pr-3 font-serif">{fmtTime(it.occurs_at)}</td>
                        <td className="py-2 pr-3 text-stone-500">
                          {it.duration_minutes} min
                        </td>
                        <td className="py-2 pr-3 font-medium">{it.what}</td>
                        <td className="py-2 pr-3 text-stone-700">
                          {it.who_responsible ?? "—"}
                        </td>
                        <td className="py-2 pr-3 text-stone-700">
                          {it.location ?? "—"}
                        </td>
                        <td className="py-2 text-stone-600">{it.notes ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        )}

        <footer className="mt-8 border-t border-stone-300 pt-3 text-[10px] uppercase tracking-[0.15em] text-stone-400">
          Generated {format(new Date(), "PPP")}
        </footer>
      </article>
    </div>
  );
}
