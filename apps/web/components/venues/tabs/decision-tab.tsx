"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/venue-status";
import type { Database } from "@wedding-os/db";

type Decision = Database["public"]["Tables"]["venue_decisions"]["Row"] & {
  decided_by_user?: { email: string } | null;
};
type DecisionKind = Database["public"]["Enums"]["venue_decision_kind"];

const KIND_OPTIONS: DecisionKind[] = [
  "shortlisted",
  "visited",
  "quoted",
  "decided",
  "passed",
  "note",
];

const KIND_VARIANT: Record<DecisionKind, "default" | "muted" | "success" | "warning" | "destructive"> = {
  shortlisted: "muted",
  visited: "default",
  quoted: "warning",
  decided: "success",
  passed: "destructive",
  note: "muted",
};

const KIND_LABEL: Record<DecisionKind, string> = {
  ...STATUS_LABEL,
  note: "Note",
};

export function DecisionTab({
  venueId,
  userId,
  role,
  initialDecisions,
  currentStatus,
}: {
  venueId: string;
  userId: string;
  role: "admin" | "couple" | null;
  initialDecisions: Decision[];
  currentStatus: keyof typeof STATUS_LABEL;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<DecisionKind>("note");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    const text = body.trim();
    if (!text) return;
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: insErr } = await supabase.from("venue_decisions").insert({
      venue_id: venueId,
      kind,
      body: text,
      decided_by: userId,
    });
    if (insErr) {
      setError(insErr.message);
      setSubmitting(false);
      return;
    }

    // If admin recorded a status-changing decision, also flip the venue's status
    if (role === "admin" && kind !== "note" && kind !== currentStatus) {
      await supabase.from("venues").update({ status: kind }).eq("id", venueId);
    }

    setBody("");
    setKind("note");
    setSubmitting(false);
    router.refresh();
  };

  const remove = async (d: Decision) => {
    if (!confirm("Remove this entry from the decision log?")) return;
    const supabase = createClient();
    await supabase.from("venue_decisions").delete().eq("id", d.id);
    router.refresh();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        {initialDecisions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No decisions logged yet. Add the first entry to start the audit trail.
            </CardContent>
          </Card>
        ) : (
          initialDecisions.map((d) => (
            <Card key={d.id}>
              <CardContent className="space-y-2 py-4">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant={KIND_VARIANT[d.kind]}>{KIND_LABEL[d.kind]}</Badge>
                    <span className="text-muted-foreground">
                      {d.decided_by_user?.email ?? "Unknown"} ·{" "}
                      {format(parseISO(d.created_at), "PPp")}
                    </span>
                  </div>
                  {(d.decided_by === userId || role === "admin") && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Delete entry"
                      onClick={() => remove(d)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm">{d.body}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="h-fit lg:sticky lg:top-6">
        <CardContent className="space-y-3 py-4">
          <div>
            <h3 className="font-serif text-lg">Log a decision</h3>
            <p className="text-xs text-muted-foreground">
              Current status:{" "}
              <Badge variant={STATUS_VARIANT[currentStatus]}>{STATUS_LABEL[currentStatus]}</Badge>
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label>Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as DecisionKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {role === "admin" && kind !== "note" && kind !== currentStatus && (
              <p className="text-xs text-amber-700">
                Will also flip venue status to <strong>{KIND_LABEL[kind]}</strong>.
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="body">Why / details</Label>
            <Textarea
              id="body"
              rows={5}
              placeholder="What's the call and why? Anything that needs to lock or follow up on."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            onClick={handleAdd}
            disabled={submitting || !body.trim()}
            className="w-full"
          >
            {submitting ? "Logging…" : "Log decision"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
