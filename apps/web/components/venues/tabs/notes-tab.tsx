"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@wedding-os/db";

type Note = Database["public"]["Tables"]["venue_notes"]["Row"] & {
  author: { email: string } | null;
};

export function NotesTab({
  venueId,
  userId,
  role,
  initialNotes,
}: {
  venueId: string;
  userId: string;
  role: "admin" | "couple" | null;
  initialNotes: Note[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async () => {
    const text = body.trim();
    if (!text) return;
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("venue_notes").insert({
      venue_id: venueId,
      author_id: userId,
      body: text,
    });
    setSubmitting(false);
    if (!error) {
      setBody("");
      router.refresh();
    }
  };

  const togglePin = async (note: Note) => {
    const supabase = createClient();
    await supabase.from("venue_notes").update({ pinned: !note.pinned }).eq("id", note.id);
    router.refresh();
  };

  const remove = async (note: Note) => {
    if (!confirm("Delete this note?")) return;
    const supabase = createClient();
    await supabase.from("venue_notes").delete().eq("id", note.id);
    router.refresh();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {initialNotes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No notes yet.
            </CardContent>
          </Card>
        ) : (
          initialNotes.map((n) => {
            const canEdit = n.author_id === userId || role === "admin";
            return (
              <Card key={n.id} className={n.pinned ? "border-foreground/30" : undefined}>
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {n.author?.email ?? "Unknown"} ·{" "}
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      {n.pinned && <span className="ml-2 font-medium text-foreground">Pinned</span>}
                    </span>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={n.pinned ? "Unpin" : "Pin"}
                          onClick={() => togglePin(n)}
                        >
                          {n.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Delete"
                          onClick={() => remove(n)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Card className="h-fit lg:sticky lg:top-6">
        <CardContent className="space-y-3 py-4">
          <h3 className="font-serif text-lg">Add a note</h3>
          <Textarea
            placeholder="Visit impressions, vendor follow-ups, questions for your planner…"
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button onClick={handleAdd} disabled={submitting || !body.trim()} className="w-full">
            {submitting ? "Posting…" : "Post note"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
