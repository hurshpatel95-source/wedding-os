import { createClient } from "@/lib/supabase/server";
import { AssistantChat } from "@/components/assistant/assistant-chat";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get the user's most recent conversation if any
  let conversationId: string | null = null;
  let initialMessages: { role: "user" | "assistant"; content: string }[] = [];
  let dailyUsed = 0;

  if (user) {
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: conv }, { data: usage }] = await Promise.all([
      supabase
        .from("ai_conversations")
        .select("id")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("ai_usage_daily")
        .select("message_count")
        .eq("user_id", user.id)
        .eq("day", today)
        .maybeSingle(),
    ]);

    dailyUsed = (usage as { message_count: number } | null)?.message_count ?? 0;
    if (conv) {
      conversationId = conv.id;
      const { data: msgs } = await supabase
        .from("ai_messages")
        .select("role, content")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true });
      initialMessages = (msgs ?? []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
    }
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Workspace-aware AI · Haiku 4.5 · capped at 30 messages/day
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Co-pilot
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Ask anything about your wedding — Claude reads every venue, vendor, scenario, guest, and
          plan task in your workspace, and answers with your real data. Try
          {" "}<em>"compare Option 1 and Scenario 3"</em>, <em>"what's due in 30 days?"</em>, or{" "}
          <em>"what should we ask Astha next?"</em>
        </p>
      </header>

      <AssistantChat
        initialConversationId={conversationId}
        initialMessages={initialMessages}
        initialDailyUsed={dailyUsed}
      />
    </div>
  );
}
