import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { VendorDetailTabs } from "@/components/vendors/vendor-detail-tabs";
import { VendorEditButton } from "@/components/vendors/vendor-edit-button";
import { VendorComposeButton } from "@/components/email/vendor-compose-button";
import { WhatsAppLink } from "@/components/whatsapp-link";
import {
  VENDOR_CATEGORY_ICON,
  VENDOR_CATEGORY_LABEL,
  VENDOR_STATUS_LABEL,
  VENDOR_STATUS_VARIANT,
} from "@/lib/vendor-categories";
import type {
  VendorAttachmentRow,
  VendorRow,
  VendorTaskRow,
} from "@/lib/vendor-types";

export const dynamic = "force-dynamic";

// Cast helper — vendor tables aren't in the generated Database types yet but RLS is enforced.
type VendorClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle?: () => Promise<{ data: unknown; error: unknown }>;
        order?: (col: string, opts?: { ascending: boolean; nullsFirst?: boolean }) => Promise<{
          data: unknown;
          error: unknown;
        }>;
      };
    };
  };
};

export default async function VendorDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sb = supabase as unknown as VendorClient;

  const [vendorRes, profileRes, tasksRes, attachmentsRes] = await Promise.all([
    (sb.from("vendors").select("*").eq("id", params.id) as unknown as {
      maybeSingle: () => Promise<{ data: VendorRow | null; error: unknown }>;
    }).maybeSingle(),
    supabase.from("users").select("role").eq("id", user.id).maybeSingle(),
    (sb
      .from("vendor_tasks")
      .select("*")
      .eq("vendor_id", params.id) as unknown as {
      order: (
        col: string,
        opts: { ascending: boolean; nullsFirst?: boolean },
      ) => Promise<{ data: VendorTaskRow[] | null; error: unknown }>;
    }).order("created_at", { ascending: false }),
    (sb
      .from("vendor_attachments")
      .select("*")
      .eq("vendor_id", params.id) as unknown as {
      order: (
        col: string,
        opts: { ascending: boolean; nullsFirst?: boolean },
      ) => Promise<{ data: VendorAttachmentRow[] | null; error: unknown }>;
    }).order("created_at", { ascending: false }),
  ]);

  const vendor = vendorRes.data as VendorRow | null;
  if (!vendor) notFound();

  const role = ((profileRes.data as { role: string | null } | null)?.role ?? null) as
    | "admin"
    | "couple"
    | null;
  const isAdmin = role === "admin";

  const tasks = (tasksRes.data ?? []) as VendorTaskRow[];
  const attachments = (attachmentsRes.data ?? []) as VendorAttachmentRow[];

  const Icon = VENDOR_CATEGORY_ICON[vendor.category];

  // Resolve studio + wedding date so we can pre-fill WhatsApp message:
  // "Hi {vendor}, {studio} here — looking for {category} for a wedding on {date}."
  const [{ data: workspaceRow }, { data: orgRow }] = await Promise.all([
    supabase
      .from("workspaces")
      .select("name, wedding_date")
      .eq("id", vendor.workspace_id)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select("name")
      .eq("id", vendor.org_id)
      .maybeSingle(),
  ]);
  const studioName: string | null =
    (orgRow as { name?: string | null } | null)?.name ?? null;
  const weddingDate =
    (workspaceRow as { wedding_date?: string | null } | null)?.wedding_date ??
    null;
  const formattedDate = weddingDate
    ? new Date(weddingDate).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const categoryLabel = VENDOR_CATEGORY_LABEL[vendor.category].toLowerCase();
  const whatsappText =
    studioName && formattedDate
      ? `Hi ${vendor.name}, ${studioName} here — looking for ${categoryLabel} for a wedding on ${formattedDate}.`
      : studioName
        ? `Hi ${vendor.name}, ${studioName} here — looking for ${categoryLabel} for an upcoming wedding.`
        : undefined;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl">{vendor.name}</h1>
            <Badge variant={VENDOR_STATUS_VARIANT[vendor.status]}>
              {VENDOR_STATUS_LABEL[vendor.status]}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant="secondary"
              className="flex items-center gap-1 text-[10px] uppercase tracking-wider"
            >
              <Icon className="h-3 w-3" />
              {VENDOR_CATEGORY_LABEL[vendor.category]}
            </Badge>
            {(vendor.contact_name || vendor.contact_email) && (
              <p className="text-sm text-muted-foreground">
                {[vendor.contact_name, vendor.contact_email].filter(Boolean).join(" · ")}
              </p>
            )}
            {vendor.contact_phone && (
              <WhatsAppLink
                phone={vendor.contact_phone}
                text={whatsappText}
                variant="pill"
              />
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Compose-with-AI is a planner workflow (Gmail integration)
              and stays admin-only. Edit is open to couples too — they
              need to update vendors they own (planner, photographer
              they booked directly, etc.). */}
          {isAdmin && (
            <VendorComposeButton
              vendorId={vendor.id}
              vendorName={vendor.name}
              vendorEmail={vendor.contact_email}
            />
          )}
          <VendorEditButton vendor={vendor} />
        </div>
      </header>

      <VendorDetailTabs
        vendor={vendor}
        userId={user.id}
        role={role}
        initialTasks={tasks}
        initialAttachments={attachments}
      />
    </div>
  );
}
