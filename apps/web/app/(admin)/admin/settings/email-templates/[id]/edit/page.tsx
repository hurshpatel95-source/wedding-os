import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { EmailTemplateForm } from "@/components/admin-email-templates/template-form";

export const dynamic = "force-dynamic";

interface TemplateRecord {
  id: string;
  name: string;
  kind: string | null;
  subject: string;
  body: string;
}

export default async function EditEmailTemplatePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{ data: TemplateRecord | null }>;
        };
      };
    };
  };

  const { data: template } = await sb
    .from("email_templates")
    .select("id, name, kind, subject, body")
    .eq("id", params.id)
    .maybeSingle();

  if (!template) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/admin/settings/email-templates"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900"
        >
          <ChevronLeft className="h-3 w-3" />
          Back to templates
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-3xl">Edit template</CardTitle>
          <p className="text-sm text-stone-500">
            Update the template — every future use of it will pick up the
            changes.
          </p>
        </CardHeader>
        <CardContent>
          <EmailTemplateForm mode="edit" template={template} />
        </CardContent>
      </Card>
    </div>
  );
}
