"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type Mode = "accept" | "decline" | null;

export function ProposalDecisionPanel({
  token,
  orgName,
}: {
  token: string;
  orgName: string;
}) {
  const [mode, setMode] = useState<Mode>(null);

  return (
    <>
      <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm">
        <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
          Ready when you are
        </div>
        <h3 className="mt-2 font-serif text-3xl font-light tracking-tight">
          Accept this proposal?
        </h3>
        <p className="mt-3 text-sm text-stone-600">
          One click locks {orgName} in for your day. If anything needs
          tweaking, decline with a note and they&rsquo;ll come back with a
          revision.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => setMode("accept")}
            className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-stone-800"
          >
            Accept proposal
          </button>
          <button
            type="button"
            onClick={() => setMode("decline")}
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-6 py-3 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900"
          >
            Decline
          </button>
        </div>
      </div>

      <AcceptDialog
        open={mode === "accept"}
        onClose={() => setMode(null)}
        token={token}
      />
      <DeclineDialog
        open={mode === "decline"}
        onClose={() => setMode(null)}
        token={token}
      />
    </>
  );
}

function AcceptDialog({
  open,
  onClose,
  token,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
}) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = confirmText.trim().toLowerCase() === "i accept";

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/proposal/${token}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || "Could not accept");
      toast.success("Accepted!");
      onClose();
      setConfirmText("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not accept");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o: boolean) => {
        if (!o) {
          onClose();
          setConfirmText("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Accept this proposal</DialogTitle>
          <DialogDescription>
            Type <span className="font-mono font-semibold">I accept</span> below
            to confirm. Your planner will be notified immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="I accept"
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
            autoFocus
          />
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => {
              onClose();
              setConfirmText("");
            }}
            disabled={busy}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || busy}
            className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-50"
          >
            {busy ? "Accepting…" : "Confirm acceptance"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeclineDialog({
  open,
  onClose,
  token,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/proposal/${token}/decline`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || null }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || "Could not decline");
      toast.success("Declined");
      onClose();
      setReason("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not decline");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o: boolean) => {
        if (!o) {
          onClose();
          setReason("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decline this proposal</DialogTitle>
          <DialogDescription>
            Optional — share a quick note so your planner can adjust and come
            back with a revision.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Budget is a bit higher than we expected — can you trim the catering tier?"
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
          />
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => {
              onClose();
              setReason("");
            }}
            disabled={busy}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            {busy ? "Declining…" : "Confirm decline"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
