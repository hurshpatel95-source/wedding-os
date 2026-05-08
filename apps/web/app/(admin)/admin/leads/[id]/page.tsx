import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  Mail,
  MapPin,
  Phone,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LeadDetailControls } from "@/components/admin-leads/lead-detail-controls";
import { LeadStatusBadge } from "@/components/admin-leads/lead-status-badge";
import { InlineEmailComposer } from "@/components/email/inline-email-composer";
import { EmailThreadList } from "@/components/email/email-thread-list";
import { WhatsAppLink } from "@/components/whatsapp-link";
import {
  LEAD_SOURCE_LABEL,
  type LeadRow,
} from "@/lib/lead-types";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: LeadRow | null }>;
        };
      };
    };
  };

  const { data: lead } = await sb
    .from("leads")
    .select(
      "id, org_id, referring_workspace_id, source, status, couple_names, partner_a_name, partner_b_name, email, phone, wedding_date, guest_count, budget_band, city_or_region, notes, scheduled_call_at, scheduled_call_duration_minutes, converted_workspace_id, converted_at, assigned_to_user_id, metadata, created_at, updated_at",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!lead) notFound();

  // Team members in this org for the "Assigned to" dropdown.
  const teamSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{ data: Array<{ id: string; email: string }> | null }>;
        };
      };
    };
  };
  const { data: teamMembersRaw } = await teamSb
    .from("users")
    .select("id, email")
    .eq("org_role", "org_admin")
    .order("created_at", { ascending: true });
  const teamMembers = teamMembersRaw ?? [];

  // Org name powers the pre-filled WhatsApp message: "Hi <names>, this is <studio>…"
  const { data: orgRow } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", lead.org_id)
    .maybeSingle();
  const studioName: string | null = (orgRow as { name?: string | null } | null)?.name ?? null;

  const referringName: string | null = lead.referring_workspace_id
    ? await (async () => {
        const { data } = await supabase
          .from("workspaces")
          .select("name")
          .eq("id", lead.referring_workspace_id as string)
          .maybeSingle();
        return data?.name ?? null;
      })()
    : null;

  const convertedName: string | null = lead.converted_workspace_id
    ? await (async () => {
        const { data } = await supabase
          .from("workspaces")
          .select("name")
          .eq("id", lead.converted_workspace_id as string)
          .maybeSingle();
        return data?.name ?? null;
      })()
    : null;

  const name =
    lead.couple_names ||
    [lead.partner_a_name, lead.partner_b_name].filter(Boolean).join(" & ") ||
    "Unnamed lead";

  const whatsappText = studioName
    ? `Hi ${name}, this is ${studioName}. Got your inquiry — would love to chat about your wedding plans.`
    : `Hi ${name} — got your inquiry, would love to chat about your wedding plans.`;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/leads"
        className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All leads
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-4xl font-light tracking-tight">
              {name}
            </h1>
            <LeadStatusBadge status={lead.status} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-600">
            <Tag icon={Mail} text={lead.email ?? "no email"} />
            <Tag icon={Phone} text={lead.phone ?? "no phone"} />
            {lead.phone && (
              <WhatsAppLink phone={lead.phone} text={whatsappText} variant="pill" />
            )}
            {lead.city_or_region && (
              <Tag icon={MapPin} text={lead.city_or_region} />
            )}
            {lead.guest_count != null && (
              <Tag icon={Users} text={`${lead.guest_count} guests`} />
            )}
            {lead.wedding_date && (
              <Tag icon={Calendar} text={formatDate(lead.wedding_date)} />
            )}
          </div>
          <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-stone-500">
            Source: {LEAD_SOURCE_LABEL[lead.source]}
            {referringName && <span> · referred by {referringName}</span>}
            {convertedName && <span> · converted to {convertedName}</span>}
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6 lg:order-1">
          {lead.scheduled_call_at && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-amber-900">
                Scheduled call
              </div>
              <div className="mt-1 font-serif text-2xl font-light text-amber-900">
                {format(parseISO(lead.scheduled_call_at), "EEE MMM d · h:mm a")}
              </div>
              <div className="text-[11px] text-amber-800">
                {lead.scheduled_call_duration_minutes ?? 45}-minute call
              </div>
            </div>
          )}

          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Their note
            </div>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-800">
              {lead.notes || (
                <span className="italic text-stone-400">
                  No note left.
                </span>
              )}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl font-light tracking-tight">
                Conversation
              </h2>
              <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                Email thread
              </span>
            </div>
            <InlineEmailComposer
              contextKind="lead"
              contextId={lead.id}
              defaultTo={lead.email}
              draftHelperKind="vendor_followup"
            />
            <EmailThreadList contextKind="lead" contextId={lead.id} />
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Details
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-2">
              <Row k="Names" v={name} />
              <Row k="Email" v={lead.email ?? "—"} />
              <Row k="Phone" v={lead.phone ?? "—"} />
              <Row k="Wedding date" v={lead.wedding_date ? formatDate(lead.wedding_date) : "—"} />
              <Row k="Guest count" v={lead.guest_count != null ? String(lead.guest_count) : "—"} />
              <Row k="Budget band" v={lead.budget_band ?? "—"} />
              <Row k="Region" v={lead.city_or_region ?? "—"} />
              <Row k="Source" v={LEAD_SOURCE_LABEL[lead.source]} />
              <Row k="Created" v={formatDate(lead.created_at)} />
              <Row k="Last updated" v={formatDate(lead.updated_at)} />
            </dl>
          </section>
        </div>

        <aside className="order-first space-y-4 lg:order-2">
          <LeadDetailControls
            leadId={lead.id}
            currentStatus={lead.status}
            isConverted={!!lead.converted_workspace_id}
            email={lead.email}
            phone={lead.phone}
            coupleNames={name}
            assignedToUserId={lead.assigned_to_user_id ?? null}
            teamMembers={teamMembers}
            whatsappText={whatsappText}
          />
        </aside>
      </div>
    </div>
  );
}

function Tag({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-stone-400" />
      {text}
    </span>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-stone-100 py-2 last:border-b-0">
      <dt className="text-stone-500">{k}</dt>
      <dd className="text-right font-medium text-stone-900">{v}</dd>
    </div>
  );
}

function formatDate(d: string) {
  try {
    return format(parseISO(d), "MMM d, yyyy");
  } catch {
    return d;
  }
}
