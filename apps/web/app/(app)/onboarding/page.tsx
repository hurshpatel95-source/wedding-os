import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingChat } from "@/components/onboarding/onboarding-chat";
import type {
  IntakeChatMessage,
  IntakeExtractedData,
  IntakeSessionRow,
} from "@/lib/autopilot-types";

export const dynamic = "force-dynamic";

// `intake_sessions` is not in the generated Database types yet, so we cast for
// reads/writes to that table. (Same pattern used elsewhere — vendors, alerts.)
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
    .select("id, name, wedding_date")
    .eq("id", profile.workspace_id)
    .maybeSingle();
  if (!workspace) redirect("/login");

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

  let session = existing;
  if (!session) {
    const initialAssistant: IntakeChatMessage = {
      role: "assistant",
      content:
        "Congrats on the engagement! I'm your wedding-os planning host. I'll ask a few quick questions so your dashboard isn't empty when you land on it. First — what are your two names?",
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
          Takes 3 minutes. Your answers prefill your dashboard, budget, and
          first-month checklist — no empty screens to stare at.
        </p>
      </header>

      <OnboardingChat
        sessionId={session.id}
        initialMessages={session.chat_messages}
        initialExtracted={session.extracted_data}
        workspaceName={workspace.name}
      />
    </div>
  );
}
