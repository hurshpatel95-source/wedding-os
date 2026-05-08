import Link from "next/link";
import { ChevronLeft, Mail, Plus } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { EmailTemplateRowActions } from "@/components/admin-email-templates/template-row-actions";
import {
  EMAIL_TEMPLATE_KIND_LABEL,
  type EmailTemplateLibraryKind,
} from "@/lib/email-template-kinds";
import type { EmailTemplateRow } from "@/lib/wave2-types";

export const dynamic = "force-dynamic";

export default async function AdminEmailTemplatesPage() {
  const supabase = createClient();

  // Cast — the planner-OS slab tables aren't fully typed yet. RLS keeps
  // this org-scoped without us having to filter in code.
  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{ data: EmailTemplateRow[] | null }>;
      };
    };
  };

  let templates: EmailTemplateRow[] = [];
  try {
    const { data } = await sb
      .from("email_templates")
      .select(
        "id, org_id, name, kind, subject, body, is_shared, use_count, last_used_at, created_by, created_at, updated_at",
      )
      .order("name", { ascending: true });
    templates = data ?? [];
  } catch {
    templates = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/settings"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900"
        >
          <ChevronLeft className="h-3 w-3" />
          Back to settings
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Settings
          </div>
          <h1 className="mt-2 font-serif text-4xl tracking-tight md:text-5xl">
            Email templates
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-600">
            Save the emails you send all the time. Reuse them across clients
            with one click — pick a template from the composer and the
            subject + body are filled in for you.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/settings/email-templates/new">
            <Plus className="mr-1 h-4 w-4" />
            New template
          </Link>
        </Button>
      </header>

      {templates.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No saved templates yet"
          description={
            'Save the emails you write the same way every week. Good first templates: "Vendor RFP - photographers", "RSVP final nudge", "Hotel block reminder".'
          }
          primary={{
            label: "+ New template",
            href: "/admin/settings/email-templates/new",
          }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-[10px] uppercase tracking-[0.2em] text-stone-500">
                  <th className="px-5 py-3 text-left font-medium">Name</th>
                  <th className="px-5 py-3 text-left font-medium">Kind</th>
                  <th className="px-5 py-3 text-left font-medium">Last used</th>
                  <th className="px-5 py-3 text-right font-medium">Used</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-stone-100 last:border-b-0 hover:bg-stone-50"
                  >
                    <td className="px-5 py-3 align-top">
                      <Link
                        href={`/admin/settings/email-templates/${t.id}/edit`}
                        className="font-medium text-stone-900 hover:underline"
                      >
                        {t.name}
                      </Link>
                      <div className="mt-0.5 line-clamp-1 text-xs text-stone-500">
                        {t.subject}
                      </div>
                    </td>
                    <td className="px-5 py-3 align-top">
                      <span className="text-xs uppercase tracking-wider text-stone-600">
                        {kindLabel(t.kind)}
                      </span>
                    </td>
                    <td className="px-5 py-3 align-top text-xs text-stone-500">
                      {t.last_used_at
                        ? formatDistanceToNow(parseISO(t.last_used_at), {
                            addSuffix: true,
                          })
                        : "Never"}
                    </td>
                    <td className="px-5 py-3 text-right align-top tabular-nums text-stone-700">
                      {t.use_count}
                    </td>
                    <td className="px-5 py-3 text-right align-top">
                      <EmailTemplateRowActions
                        id={t.id}
                        name={t.name}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function kindLabel(kind: string | null): string {
  if (!kind) return "—";
  if (kind in EMAIL_TEMPLATE_KIND_LABEL) {
    return EMAIL_TEMPLATE_KIND_LABEL[kind as EmailTemplateLibraryKind];
  }
  return kind;
}
