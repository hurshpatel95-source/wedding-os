import { Mail, Sparkles, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { VendorGrid } from "@/components/vendors/vendor-grid";
import { VendorCreateButton } from "@/components/vendors/vendor-create-button";
import { Badge } from "@/components/ui/badge";
import type { VendorRow } from "@/lib/vendor-types";

export const dynamic = "force-dynamic";

type VendorListItem = Pick<
  VendorRow,
  | "id"
  | "name"
  | "category"
  | "status"
  | "contact_name"
  | "contact_email"
  | "quoted_price_eur"
  | "deposit_amount_eur"
  | "deposit_due_at"
  | "deposit_paid_at"
  | "notes"
  | "created_at"
>;

export default async function VendorsPage() {
  const supabase = createClient();

  // `vendors` is not yet in the generated Database types; cast for the from() call only.
  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{ data: VendorListItem[] | null }>;
      };
    };
  };

  const [{ data: vendors }, { data: { user } }] = await Promise.all([
    sb
      .from("vendors")
      .select(
        "id, name, category, status, contact_name, contact_email, quoted_price_eur, deposit_amount_eur, deposit_due_at, deposit_paid_at, notes, created_at",
      )
      .order("created_at", { ascending: true }),
    supabase.auth.getUser(),
  ]);

  let role: "admin" | "couple" | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = (profile?.role ?? null) as typeof role;
  }

  const list: VendorListItem[] = vendors ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight md:text-5xl">Vendors</h1>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Florists, photo + video, DJs, MUAs, transport — every vendor for the wedding
          </p>
        </div>
        {role === "admin" && <VendorCreateButton />}
      </header>

      {role === "admin" && (
        <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <Zap className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-serif text-lg">
                  Gmail integration · coming soon
                </h3>
                <Badge variant="muted" className="text-[10px]">
                  Phase 2
                </Badge>
              </div>
              <p className="max-w-3xl text-sm text-stone-600">
                Connect Astia's Gmail and wedding-os will{" "}
                <span className="font-medium text-stone-900">monitor incoming vendor emails</span>,{" "}
                <span className="font-medium text-stone-900">auto-update vendor statuses</span> when
                a quote arrives, and route every thread to the right client. For now: open any
                vendor and click <Sparkles className="inline h-3 w-3 align-text-top" /> Compose with
                AI to get a Claude-drafted email you can paste into Gmail.
              </p>
            </div>
            <span
              className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-800"
              title="Coming in Phase 2"
            >
              <Mail className="h-3 w-3" />
              Beta list opens soon
            </span>
          </div>
        </div>
      )}

      <VendorGrid vendors={list} role={role} />
    </div>
  );
}
