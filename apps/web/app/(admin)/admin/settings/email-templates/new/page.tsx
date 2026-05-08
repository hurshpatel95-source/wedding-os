import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmailTemplateForm } from "@/components/admin-email-templates/template-form";

export const dynamic = "force-dynamic";

export default function NewEmailTemplatePage() {
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
          <CardTitle className="font-serif text-3xl">New email template</CardTitle>
          <p className="text-sm text-stone-500">
            Save the email you write all the time. Use{" "}
            <code className="text-stone-700">{"{first_name}"}</code>,{" "}
            <code className="text-stone-700">{"{couple_names}"}</code>,{" "}
            <code className="text-stone-700">{"{wedding_date}"}</code> etc. so
            each send fills in the right person.
          </p>
        </CardHeader>
        <CardContent>
          <EmailTemplateForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
