import { createClient } from "@/lib/supabase/server";

export default async function AdminHomePage() {
  const supabase = createClient();

  // The current user's org_id is enforced by RLS for both `workspaces` and
  // (post-migration) `library_venues`, but we read defensively for the
  // pre-migration case too.
  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string, opts?: { count: "exact"; head: true }) => {
        eq?: (col: string, val: string) => Promise<{ count: number | null }>;
        // unused branches kept loose
      } & Promise<{ count: number | null }>;
    };
  };

  const { count: clientsCount } = await supabase
    .from("workspaces")
    .select("id", { count: "exact", head: true });

  let librarySize: number | null = null;
  try {
    const { count } = await (sb as unknown as {
      from: (t: string) => {
        select: (
          c: string,
          o: { count: "exact"; head: true },
        ) => Promise<{ count: number | null }>;
      };
    })
      .from("library_venues")
      .select("id", { count: "exact", head: true });
    librarySize = count ?? 0;
  } catch {
    // Migration not applied yet — fall through to "—".
    librarySize = null;
  }

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section>
        <div className="mb-4 text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Planner studio
        </div>
        <h1 className="font-serif text-5xl font-light leading-[1.05] tracking-tight md:text-6xl">
          Your studio
        </h1>
        <p className="mt-6 max-w-xl leading-relaxed text-stone-600">
          One workspace per couple. Reusable library + playbook across every
          client. Sub-pages light up as Wave 2 ships.
        </p>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Clients"
          value={String(clientsCount ?? 0)}
          sub="couple workspaces in your org"
        />
        <StatCard
          label="Library size"
          value={librarySize === null ? "—" : String(librarySize)}
          sub="reusable venues"
        />
        <StatCard
          label="Recent activity"
          value="—"
          sub="No activity yet"
        />
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
      <div className="mb-1 mt-2 font-serif text-3xl font-light leading-none">{value}</div>
      <div className="text-xs text-stone-500">{sub}</div>
    </div>
  );
}
