"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface TestimonialWorkspaceOption {
  id: string;
  name: string;
  wedding_date: string | null;
  is_past: boolean;
  contact_email: string | null;
}

export function TestimonialRequestButton({
  workspaces,
}: {
  workspaces: TestimonialWorkspaceOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [coupleNames, setCoupleNames] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [intro, setIntro] = useState("");
  const [error, setError] = useState<string | null>(null);

  const workspaceById = useMemo(
    () => new Map(workspaces.map((w) => [w.id, w])),
    [workspaces],
  );

  const handleWorkspaceChange = (id: string) => {
    setWorkspaceId(id);
    if (!id) {
      return;
    }
    const w = workspaceById.get(id);
    if (!w) return;
    if (!coupleNames.trim()) setCoupleNames(w.name);
    if (!contactEmail.trim() && w.contact_email) setContactEmail(w.contact_email);
  };

  const reset = () => {
    setWorkspaceId("");
    setCoupleNames("");
    setContactEmail("");
    setSubject("");
    setIntro("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const couple = coupleNames.trim();
    const email = contactEmail.trim();
    if (!couple) {
      setError("Add the couple's names so they recognize the email.");
      return;
    }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Enter a valid contact email.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/testimonials/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId || null,
          couple_names: couple,
          contact_email: email,
          subject: subject.trim() || null,
          intro: intro.trim() || null,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        email_ok?: boolean;
        email_error?: string;
      };
      if (!res.ok || json.ok === false) {
        setError(json.error ?? "Couldn't send the request.");
        setSubmitting(false);
        return;
      }
      if (json.email_ok === false) {
        toast.warning("Testimonial request created — but email failed.", {
          description: json.email_error,
        });
      } else {
        toast.success("Testimonial request sent.");
      }
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
      >
        <PlusCircle className="h-3.5 w-3.5" />
        Request testimonial
      </button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request a testimonial</DialogTitle>
            <DialogDescription>
              We&rsquo;ll email a one-click submission link. Past clients show
              up first in the dropdown.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-stone-500">
                Link to client (optional)
              </span>
              <select
                value={workspaceId}
                onChange={(e) => handleWorkspaceChange(e.target.value)}
                className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
              >
                <option value="">— Ad-hoc (no client linked) —</option>
                {workspaces
                  .filter((w) => w.is_past)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {w.wedding_date ? ` · ${w.wedding_date}` : ""}
                    </option>
                  ))}
                {workspaces.some((w) => w.is_past) &&
                  workspaces.some((w) => !w.is_past) && (
                    <option disabled>──────────</option>
                  )}
                {workspaces
                  .filter((w) => !w.is_past)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {w.wedding_date ? ` · ${w.wedding_date}` : " · upcoming"}
                    </option>
                  ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-stone-500">
                Couple names
              </span>
              <input
                value={coupleNames}
                onChange={(e) => setCoupleNames(e.target.value)}
                required
                placeholder="Anna & Marco"
                className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-stone-500">
                Contact email
              </span>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                placeholder="anna@example.com"
                className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-stone-500">
                Email subject (optional)
              </span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Would you mind sharing a few words about your wedding?"
                className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-stone-500">
                Intro line (optional)
              </span>
              <textarea
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                rows={3}
                placeholder="It would mean the world if you'd share a couple of sentences about your experience…"
                className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
              />
            </label>

            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Send request
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
