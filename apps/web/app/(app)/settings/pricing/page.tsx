import Link from "next/link";
import { Sparkles, ArrowRight, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PricingTemplatePage() {
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
  const isAdmin = role === "admin";

  const [{ data: template }, { data: categories }, { data: lineItems }, { data: recentIntakes }, { data: changeLog }] =
    await Promise.all([
      supabase.from("pricing_templates").select("id, name, version").limit(1).maybeSingle(),
      supabase.from("pricing_categories").select("id, label, sort_order").order("sort_order"),
      supabase
        .from("pricing_line_items")
        .select("id, category_id, label, unit, default_unit_price, currency, tier, sort_order")
        .order("sort_order"),
      supabase
        .from("pricing_intake_sources")
        .select("id, source_label, kind, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("pricing_change_log")
        .select("id, target, actor_kind, created_at, line_item_id, venue_id")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const cats = categories ?? [];
  const items = lineItems ?? [];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Source of truth for the pricing engine
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Pricing template
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {template?.name ?? "Wedding Standard"} — every default price the scenario builder
          uses. Update via the AI intake (preferred) or directly on each venue's Pricing tab.
        </p>
      </header>

      {isAdmin && (
        <Link href="/settings/pricing/intake">
          <Card className="border-rose-200 bg-gradient-to-br from-rose-50 via-white to-amber-50 transition hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="flex flex-wrap items-start gap-4 py-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-serif text-xl">AI Pricing intake</h2>
                  <Badge variant="warning" className="text-[10px]">
                    Recommended
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-stone-700">
                  Drop a screenshot of your planner's WhatsApp screenshot, a PDF of the latest deck, or paste an
                  email thread. Claude reads it, matches to your existing line items, and shows
                  proposed changes for review. Nothing applies until you confirm.
                </p>
              </div>
              <div className="flex items-center gap-1 text-sm font-medium text-rose-800">
                Open <ArrowRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Recent intakes */}
      {(recentIntakes ?? []).length > 0 && (
        <Card>
          <CardContent className="py-5">
            <h3 className="mb-3 font-serif text-xl">Recent intakes</h3>
            <div className="space-y-2">
              {(recentIntakes ?? []).map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-100 px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{s.source_label ?? "(no label)"}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.kind} · {new Date(s.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge
                    variant={
                      s.status === "applied"
                        ? "success"
                        : s.status === "extracted"
                        ? "warning"
                        : s.status === "failed"
                        ? "destructive"
                        : "muted"
                    }
                    className="text-[10px]"
                  >
                    {s.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Line items grouped by category */}
      <Card>
        <CardContent className="py-5">
          <h3 className="mb-3 font-serif text-xl">
            Line items <span className="text-sm font-normal text-muted-foreground">{items.length}</span>
          </h3>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No line items yet. Run <code className="rounded bg-stone-100 px-1.5 py-0.5">pnpm db:seed</code>.
            </p>
          ) : (
            <div className="space-y-4">
              {cats.map((c) => {
                const inCat = items.filter((li) => li.category_id === c.id);
                if (inCat.length === 0) return null;
                return (
                  <section key={c.id}>
                    <div className="mb-1 text-[10px] uppercase tracking-[0.15em] text-stone-500">
                      {c.label}
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-stone-200">
                      <table className="w-full text-sm">
                        <thead className="bg-stone-50 text-[10px] uppercase tracking-[0.15em] text-stone-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Item</th>
                            <th className="px-3 py-2 text-left">Unit</th>
                            <th className="px-3 py-2 text-left">Tier</th>
                            <th className="px-3 py-2 text-right">Default price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inCat.map((li) => (
                            <tr key={li.id} className="border-t border-stone-100">
                              <td className="px-3 py-2">{li.label}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">
                                {li.unit.replace("_", " ")}
                              </td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">
                                {li.tier ?? "—"}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {li.currency} {Number(li.default_unit_price).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent change log */}
      {(changeLog ?? []).length > 0 && (
        <Card>
          <CardContent className="py-5">
            <div className="mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-stone-500" />
              <h3 className="font-serif text-xl">Recent price changes</h3>
            </div>
            <ul className="space-y-1.5 text-xs text-stone-700">
              {(changeLog ?? []).map((e) => (
                <li key={e.id} className="flex gap-2">
                  <span className="text-stone-400">·</span>
                  <span>
                    {e.target} ·{" "}
                    <Badge variant="muted" className="text-[10px]">
                      {e.actor_kind}
                    </Badge>{" "}
                    · {new Date(e.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
