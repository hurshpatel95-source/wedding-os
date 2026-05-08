import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { VendorDetailTabs } from "@/components/vendors/vendor-detail-tabs";
import { VendorEditButton } from "@/components/vendors/vendor-edit-button";
import { VendorComposeButton } from "@/components/email/vendor-compose-button";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { AnalyzeWithAiButton } from "@/components/autopilot/analyze-button";
import {
  VENDOR_CATEGORY_ICON,
  VENDOR_CATEGORY_LABEL,
  VENDOR_STATUS_LABEL,
  VENDOR_STATUS_VARIANT,
} from "@/lib/vendor-categories";
import {
  VENDOR_AUTOPILOT_LABEL,
  type VendorAutopilotStatus,
} from "@/lib/autopilot-types";
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

      {/* ── Autopilot status block (read-only) ────────────────────────
          Surfaces the AI-generated summary + autopilot lifecycle state at
          the very top of the vendor detail page so the couple can see at
          a glance "where this vendor stands" without scrolling.

          MOUNT INSTRUCTIONS for the THREAD-ANALYZER agent's "Analyze with
          AI" button:
            import { AnalyzeButton } from "@/components/autopilot/analyze-button";
          Render `<AnalyzeButton vendorId={vendor.id} />` inside the
          `<div className="flex flex-wrap gap-2">` action row at the top
          of the header above. Until that component lands, this block is
          read-only — the AI summary is populated by background autopilot
          runs, not on click.
      */}
      <AutopilotStatusBlock
        autopilotStatus={
          (vendor as unknown as { autopilot_status?: VendorAutopilotStatus | null })
            .autopilot_status ?? "none"
        }
        autopilotEnabled={
          (vendor as unknown as { autopilot_enabled?: boolean | null })
            .autopilot_enabled ?? false
        }
        aiSummary={
          (vendor as unknown as { ai_summary?: string | null }).ai_summary ?? null
        }
        quoteEur={
          (vendor as unknown as { quote_eur?: number | null }).quote_eur ?? null
        }
        lastInboundAt={
          (vendor as unknown as { last_inbound_at?: string | null })
            .last_inbound_at ?? null
        }
        lastOutboundAt={
          (vendor as unknown as { last_outbound_at?: string | null })
            .last_outbound_at ?? null
        }
      />
      <div className="flex flex-wrap gap-2">
        <AnalyzeWithAiButton vendorId={vendor.id} />
      </div>

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

// ─── Inline read-only autopilot block ───────────────────────────────
// Lives inside the page rather than a standalone component so we don't
// race with the THREAD-ANALYZER worktree which owns the components dir.
const STATUS_PILL: Record<VendorAutopilotStatus, string> = {
  none: "bg-stone-100 text-stone-700",
  researching: "bg-sky-100 text-sky-800",
  contacted: "bg-amber-100 text-amber-800",
  quoted: "bg-violet-100 text-violet-800",
  booked: "bg-emerald-100 text-emerald-800",
  declined: "bg-stone-100 text-stone-500",
  unavailable: "bg-stone-100 text-stone-500",
};

function AutopilotStatusBlock({
  autopilotStatus,
  autopilotEnabled,
  aiSummary,
  quoteEur,
  lastInboundAt,
  lastOutboundAt,
}: {
  autopilotStatus: VendorAutopilotStatus;
  autopilotEnabled: boolean;
  aiSummary: string | null;
  quoteEur: number | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
}) {
  const fmt = (iso: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return null;
    }
  };
  const inbound = fmt(lastInboundAt);
  const outbound = fmt(lastOutboundAt);

  return (
    <section className="rounded-2xl border border-stone-200 bg-gradient-to-br from-white via-white to-stone-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
            Autopilot
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_PILL[autopilotStatus]}`}
          >
            {VENDOR_AUTOPILOT_LABEL[autopilotStatus]}
          </span>
          {autopilotEnabled ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              On
            </span>
          ) : (
            <span className="text-[11px] text-stone-400">Off</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-500">
          {quoteEur != null && (
            <span>
              Quote{" "}
              <span className="font-medium text-stone-800">
                €{Number(quoteEur).toLocaleString()}
              </span>
            </span>
          )}
          {outbound && (
            <span>
              Last sent <span className="text-stone-700">{outbound}</span>
            </span>
          )}
          {inbound && (
            <span>
              Last reply <span className="text-stone-700">{inbound}</span>
            </span>
          )}
        </div>
      </div>
      {aiSummary ? (
        <p className="mt-3 text-sm leading-relaxed text-stone-700">
          {aiSummary}
        </p>
      ) : (
        <p className="mt-3 text-xs italic text-stone-400">
          No AI summary yet — Autopilot will generate one once you exchange
          messages with this vendor.
        </p>
      )}
    </section>
  );
}
