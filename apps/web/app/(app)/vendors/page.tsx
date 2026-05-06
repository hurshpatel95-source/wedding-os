import { createClient } from "@/lib/supabase/server";
import { VendorGrid } from "@/components/vendors/vendor-grid";
import { VendorCreateButton } from "@/components/vendors/vendor-create-button";
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

      <VendorGrid vendors={list} role={role} />
    </div>
  );
}
