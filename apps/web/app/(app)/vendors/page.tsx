import Link from "next/link";
import { Briefcase, Search } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VendorGrid } from "@/components/vendors/vendor-grid";
import { VendorCreateButton } from "@/components/vendors/vendor-create-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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

  // Org_admins manage vendors via the planner CRM in /admin/vendors.
  // Send them there instead of the couple-facing read-only list.
  if (user) {
    try {
      const sbU = supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (col: string, val: string) => {
              maybeSingle: () => Promise<{
                data: { org_role?: string | null } | null;
              }>;
            };
          };
        };
      };
      const { data: profile } = await sbU
        .from("users")
        .select("org_role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.org_role === "org_admin") {
        redirect("/admin/vendors");
      }
    } catch {
      // pre-migration tolerant
    }
  }

  const list: VendorListItem[] = vendors ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Your wedding vendors
          </div>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
            Vendors
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Add anyone you&apos;re paying — your planner, photographer, florist,
            DJ, transport. Track quotes and deposits here. Your planner&apos;s
            internal CRM (contacts, RFP outreach, internal notes) stays in their
            admin view.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/vendors/find">
              <Search className="h-4 w-4" />
              Find vendors
            </Link>
          </Button>
          <VendorCreateButton />
        </div>
      </header>

      {list.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No vendors on your list yet"
          description="Track every vendor you're paying — planner, photographer, florist, DJ, transport. Quotes, deposits, and contact info live here."
          action={
            <>
              <Button asChild>
                <Link href="/vendors/find">
                  <Search className="h-4 w-4" />
                  Find vendors with AI
                </Link>
              </Button>
              <VendorCreateButton />
            </>
          }
        />
      ) : (
        <VendorGrid vendors={list} role="couple" />
      )}
    </div>
  );
}
