import Link from "next/link";
import { Briefcase, Search } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VendorGrid } from "@/components/vendors/vendor-grid";
import { VendorCreateButton } from "@/components/vendors/vendor-create-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { VendorRow } from "@/lib/vendor-types";
import { normalizeSkin } from "@/lib/workspace-skin";
import { isB2B, resolveWorkspaceMode } from "@/lib/workspace-mode";

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

  // Resolve workspace.base_currency so the grid renders the right symbol
  // for the couple's local currency.
  const { data: profile } = user
    ? await supabase
        .from("users")
        .select("workspace_id")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };
  const wsid = (profile as { workspace_id?: string | null } | null)?.workspace_id;
  const { data: workspaceRow } = wsid
    ? await supabase
        .from("workspaces")
        .select("base_currency, skin")
        .eq("id", wsid)
        .maybeSingle()
    : { data: null };
  const baseCurrency =
    (workspaceRow as { base_currency?: string | null } | null)?.base_currency ??
    "USD";
  // T1.5 — fork the empty-state copy + CTAs on workspace mode. B2C
  // couples drive their own vendor sourcing (Find AI button + manual
  // add). Planner-served couples don't add vendors themselves; their
  // planner does. Show a "your planner is curating this" empty state
  // instead of the AI-find button.
  const mode = resolveWorkspaceMode(
    normalizeSkin(
      (workspaceRow as { skin?: string | null } | null)?.skin ?? null,
    ),
  );
  const isPlannerServed = isB2B(mode);

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
            Add anyone you&apos;re paying — photographer, florist, DJ, caterer,
            transport. Track quotes, deposits, and final balances all in one
            place, and email each vendor directly from their detail page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/vendors/find">
              <Search className="h-4 w-4" />
              Find vendors
            </Link>
          </Button>
          {/* Audit #10 (2026-05-06): only show Add Vendor for self-serve
              couples. Planner-served couples have their planner manage the
              vendor list; rather than letting them write into the planner's
              CRM directly, the empty-state copy routes them to ping the
              planner. */}
          {!isPlannerServed && <VendorCreateButton />}
        </div>
      </header>

      {list.length === 0 ? (
        isPlannerServed ? (
          <EmptyState
            icon={Briefcase}
            title="Your planner is curating vendors"
            description="Vendors will appear here as your planner adds them — photographer, florist, caterer, DJ. You'll see quotes, deposits, and contact info per vendor once they're locked in. Reach out to your planner if you have a specific vendor in mind."
          />
        ) : (
          <EmptyState
            icon={Briefcase}
            title="No vendors on your list yet"
            description="Track every vendor you're paying — planner, photographer, florist, DJ, transport. Quotes, deposits, and contact info live here."
            action={
              <>
                <Link
                  href="/vendors/find"
                  className="inline-flex items-center gap-2 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-stone-700"
                >
                  <Search className="h-4 w-4" />
                  Find vendors with AI
                </Link>
                <VendorCreateButton />
              </>
            }
          />
        )
      ) : (
        <VendorGrid vendors={list} role="couple" baseCurrency={baseCurrency} />
      )}
    </div>
  );
}
