// Couple-side mass guest messaging composer page.
// Fetches the workspace's guests + recent guest_messages history and renders
// the three-pane MessageComposer client component.

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { MessageComposer } from "@/components/guests/message-composer";
import type { GuestMessageRow } from "@/lib/tier1-types";
import type { GuestSide, RsvpStatus } from "@/lib/guest-types";

export const dynamic = "force-dynamic";

interface GuestRowLite {
  id: string;
  full_name: string;
  email: string | null;
  side: GuestSide | null;
  overall_rsvp: RsvpStatus;
}

export default async function GuestMessagePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-3xl">Sign in required</h1>
        <p className="text-sm text-muted-foreground">
          You need to be signed in to a workspace to send guest messages.
        </p>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id, org_id, role")
    .eq("id", user.id)
    .maybeSingle();

  // Workspace name powers the {couple_name} preview substitution
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name")
    .limit(1)
    .maybeSingle();

  const { data: guestsRaw } = await supabase
    .from("guests")
    .select("id, full_name, email, side, overall_rsvp")
    .order("full_name", { ascending: true });
  const guests: GuestRowLite[] = (guestsRaw ?? []) as GuestRowLite[];

  // Cast to fetch guest_messages — table not in generated Database types yet
  const sbCast = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => {
          limit: (
            n: number,
          ) => Promise<{ data: GuestMessageRow[] | null; error: unknown }>;
        };
      };
    };
  };
  const { data: historyRaw } = await sbCast
    .from("guest_messages")
    .select(
      "id, kind, subject, body, channel, recipient_count, delivered_count, bounced_count, status, sent_at, created_at, segment_filter",
    )
    .order("created_at", { ascending: false })
    .limit(10);
  const history: GuestMessageRow[] = (historyRaw ?? []) as GuestMessageRow[];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Mass guest comms
          </div>
          <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
            Message guests
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Pick a segment, draft (or have Claude draft) the message, preview
            against a real guest, and send. Each recipient gets their own copy
            with name tokens substituted.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/guests">
            <Button variant="outline">
              <ChevronLeft className="h-4 w-4" /> Back to guest list
            </Button>
          </Link>
        </div>
      </header>

      <MessageComposer
        guests={guests}
        history={history}
        workspaceName={workspace?.name ?? null}
      />
    </div>
  );
}
