import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PublicSiteEditor } from "@/components/public-site/public-site-editor";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface ScheduleItem {
  time?: string;
  date?: string;
  label: string;
  location?: string;
}
interface FaqItem {
  q: string;
  a: string;
}

export default async function PublicSiteSettingsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.workspace_id) return null;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", profile.workspace_id)
    .maybeSingle();
  if (!workspace) return null;

  const isPublished = Boolean(workspace.public_published_at);
  const liveUrl = workspace.public_slug ? `/w/${workspace.public_slug}` : null;

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to dashboard
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Public wedding site
          </div>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
            Site editor
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            What guests see at your shareable link. Pick a URL, write your
            story, add registry + travel + hotel block + schedule + dress
            code + FAQ. Publish when you&rsquo;re ready.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isPublished ? (
            <Badge variant="success" className="text-[10px]">
              Published
            </Badge>
          ) : (
            <Badge variant="muted" className="text-[10px]">
              Draft
            </Badge>
          )}
          {liveUrl && (
            <Link
              href={liveUrl}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-800 transition hover:border-stone-900"
            >
              View live <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </header>

      {!liveUrl && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="py-4 text-sm text-amber-900">
            Pick a slug below to enable your shareable URL — it&rsquo;ll look
            like <code className="rounded bg-white px-1.5 py-0.5">/w/your-names</code>.
          </CardContent>
        </Card>
      )}

      <PublicSiteEditor
        initial={{
          public_slug: workspace.public_slug ?? "",
          story_html: workspace.story_html ?? "",
          registry_url: workspace.registry_url ?? "",
          registry_label: workspace.registry_label ?? "",
          travel_md: workspace.travel_md ?? "",
          hotel_block_md: workspace.hotel_block_md ?? "",
          dress_code_md: workspace.dress_code_md ?? "",
          faq: (workspace.faq as FaqItem[] | null) ?? [],
          schedule: (workspace.schedule as ScheduleItem[] | null) ?? [],
        }}
        isPublished={isPublished}
        publicSlug={workspace.public_slug ?? null}
      />
    </div>
  );
}
