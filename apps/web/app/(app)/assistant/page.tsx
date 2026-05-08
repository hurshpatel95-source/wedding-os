import { createClient } from "@/lib/supabase/server";
import { AssistantChat } from "@/components/assistant/assistant-chat";

export const dynamic = "force-dynamic";

interface ConversationListItem {
  id: string;
  preview: string;
  updated_at: string;
}

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: { conversation?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let conversationId: string | null = null;
  let initialMessages: { role: "user" | "assistant"; content: string }[] = [];
  let dailyUsed = 0;
  let conversations: ConversationListItem[] = [];

  if (user) {
    const today = new Date().toISOString().slice(0, 10);

    const { data: usage } = await supabase
      .from("ai_usage_daily")
      .select("message_count")
      .eq("user_id", user.id)
      .eq("day", today)
      .maybeSingle();
    dailyUsed = (usage as { message_count: number } | null)?.message_count ?? 0;

    // List the user's conversations (newest first), capped at 20
    const { data: convList } = await supabase
      .from("ai_conversations")
      .select("id, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20);

    // One-line preview per conversation = the first user message
    const convIds = (convList ?? []).map((c) => c.id);
    const previewByConv = new Map<string, string>();
    if (convIds.length > 0) {
      const { data: previewRows } = await supabase
        .from("ai_messages")
        .select("conversation_id, content, role, created_at")
        .in("conversation_id", convIds)
        .eq("role", "user")
        .order("created_at", { ascending: true });
      for (const m of previewRows ?? []) {
        if (!previewByConv.has(m.conversation_id)) {
          const content = m.content as string;
          previewByConv.set(
            m.conversation_id,
            content.length > 80 ? `${content.slice(0, 79)}…` : content,
          );
        }
      }
    }

    conversations = (convList ?? []).map((c) => ({
      id: c.id,
      preview: previewByConv.get(c.id) ?? "(empty thread)",
      updated_at: c.updated_at,
    }));

    // Decide which conversation to load — explicit ?conversation= first,
    // otherwise the most recent
    const requested = searchParams?.conversation;
    if (requested && conversations.some((c) => c.id === requested)) {
      conversationId = requested;
    } else if (conversations.length > 0) {
      conversationId = conversations[0].id;
    }

    if (conversationId) {
      const { data: msgs } = await supabase
        .from("ai_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
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
          {" "}<em>&ldquo;compare Option 1 and Scenario 3&rdquo;</em>, <em>&ldquo;what&rsquo;s due in 30 days?&rdquo;</em>, or{" "}
          <em>&ldquo;what should we tackle next?&rdquo;</em>
        </p>
      </header>

      <AssistantChat
        initialConversationId={conversationId}
        initialMessages={initialMessages}
        initialDailyUsed={dailyUsed}
        conversations={conversations}
      />
    </div>
  );
}
