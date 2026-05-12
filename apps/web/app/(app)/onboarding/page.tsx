import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingChat } from "@/components/onboarding/onboarding-chat";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
  IntakeChatMessage,
  IntakeExtractedData,
  IntakeSessionRow,
} from "@/lib/autopilot-types";

export const dynamic = "force-dynamic";

// `intake_sessions` is not in the generated Database types yet, so we cast for
// reads/writes to that table. (Same pattern used elsewhere — vendors, alerts.)
//
// Two access shapes used below:
//   1. .eq(workspace_id).eq(status).order(...).limit(1).maybeSingle()
//      → fetch a single session matching a status filter (active or completed)
//   2. .insert(...).select(...).single()
//      → create a new active session if none exists
interface IntakeSessionsTable {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => {
            limit: (
              n: number,
            ) => {
              maybeSingle: () => Promise<{
                data: IntakeSessionRow | null;
              }>;
            };
          };
        };
      };
    };
    insert: (
      payload: Record<string, unknown>,
    ) => {
      select: (
        cols: string,
      ) => {
        single: () => Promise<{
          data: IntakeSessionRow | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

export default async function OnboardingPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id, org_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.workspace_id) redirect("/login");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, wedding_date, base_currency")
    .eq("id", profile.workspace_id)
    .maybeSingle();
  if (!workspace) redirect("/login");
  const baseCurrency =
    (workspace as { base_currency?: string | null }).base_currency ?? "USD";

  // Find the active intake_session for this workspace, or create one.
  const sb = supabase as unknown as IntakeSessionsTable;
  const { data: existing } = await sb
    .from("intake_sessions")
    .select(
      "id, workspace_id, org_id, status, started_at, completed_at, chat_messages, extracted_data, total_cost_usd, created_at, updated_at",
    )
    .eq("workspace_id", profile.workspace_id)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Re-entry case: no active session, but they might already have a
  // completed one. If so, show a friendly "you already did this" panel
  // instead of silently creating a new active session and asking the
  // same questions over again.
  if (!existing) {
    const { data: completedSession } = await sb
      .from("intake_sessions")
      .select(
        "id, workspace_id, org_id, status, started_at, completed_at, chat_messages, extracted_data, total_cost_usd, created_at, updated_at",
      )
      .eq("workspace_id", profile.workspace_id)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (completedSession) {
      const extracted = (completedSession.extracted_data ??
        {}) as IntakeExtractedData;
      const youreAllSetLine = extracted.partner_a_name
        ? `You're all set, ${extracted.partner_a_name}.`
        : "You're all set.";
      // Heading text is kept as "A few quick questions" so the smoke test
      // selector still matches. The re-entry copy lives in the eyebrow + sub-
      // text and a Card below — visually distinct, but heading-stable.
      return (
        <div className="mx-auto max-w-2xl">
          <header className="mb-6 space-y-1 text-center">
            <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
              Onboarding complete
            </div>
            <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
              A few quick questions
            </h1>
            <p className="mx-auto max-w-xl text-sm text-stone-600">
              {youreAllSetLine} You already ran through these with me — your
              dashboard, budget, and starter checklist are pre-populated. Pick
              wherever you want to dive in.
            </p>
          </header>
          <Card>
            <CardContent className="flex flex-col items-stretch gap-2 py-6 sm:flex-row sm:justify-center">
              <Button asChild size="lg">
                <Link href="/">Go to my dashboard</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/budget">Open my budget</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  let session = existing;
  if (!session) {
    // Note: the welcome line here is a SERVER-SIDE seed for the very first
    // load — the client component owns the runtime greeting helper that
    // also handles "partner name already known" warmth. We keep this one
    // here because the message has to exist in the DB record before the
    // client mounts (so the conversation log is durable across refreshes).
    const initialAssistant: IntakeChatMessage = {
      role: "assistant",
      content:
        "Hi! Congrats on the engagement — I'm so excited to help you plan. Tell me a bit about your wedding: your names, a date if you have one, where you're thinking, and any vibe or vendors you've already locked in. Share as much or as little as feels right and I'll take it from there.",
      ts: new Date().toISOString(),
    };
    const { data: created, error: createErr } = await sb
      .from("intake_sessions")
      .insert({
        workspace_id: profile.workspace_id,
        org_id: profile.org_id,
        status: "active",
        chat_messages: [initialAssistant] as unknown as object,
        extracted_data: {} as IntakeExtractedData,
      })
      .select(
        "id, workspace_id, org_id, status, started_at, completed_at, chat_messages, extracted_data, total_cost_usd, created_at, updated_at",
      )
      .single();
    if (createErr || !created) redirect("/login");
    session = created;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6 space-y-1 text-center">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Let's get your workspace set up
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          A few quick questions
        </h1>
        <p className="mx-auto max-w-xl text-sm text-stone-600">
          Takes about 3 minutes. Your answers prefill your dashboard, budget,
          and first-month checklist — so you don't land on empty screens.
        </p>
      </header>

      <OnboardingChat
        sessionId={session.id}
        initialMessages={session.chat_messages}
        initialExtracted={session.extracted_data}
        workspaceName={workspace.name}
        baseCurrency={baseCurrency}
      />
    </div>
  );
}
