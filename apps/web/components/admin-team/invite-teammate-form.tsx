"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  InviteTeammateRequest,
  InviteTeammateResponse,
} from "@/lib/admin-team-types";

type InvitableRole = Exclude<
  InviteTeammateRequest["team_role"],
  never
>;

export function InviteTeammateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<InvitableRole>("planner");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteTeammateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setEmail("");
    setName("");
    setRole("planner");
    setError(null);
    setResult(null);
    setCopied(false);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const body: InviteTeammateRequest = {
      email: email.trim(),
      name: name.trim() || null,
      team_role: role,
    };

    try {
      const res = await fetch("/api/admin/team/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as
        | InviteTeammateResponse
        | { error: string };
      if (!res.ok || "error" in data) {
        const msg =
          ("error" in data && data.error) || "Could not invite teammate.";
        setError(msg);
        toast.error(msg);
        setSubmitting(false);
        return;
      }
      const created = data as InviteTeammateResponse;
      setResult(created);
      // Auto-copy magic link if we got one — that's what the owner needs.
      if (created.magic_link) {
        try {
          await navigator.clipboard.writeText(created.magic_link);
          setCopied(true);
          toast.success("Invite ready — magic link copied to clipboard");
        } catch {
          toast.success("Invite created. Copy the magic link to share.");
        }
      } else {
        toast.success("Invite created.");
      }
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const copyMagicLink = async () => {
    if (!result?.magic_link) return;
    await navigator.clipboard.writeText(result.magic_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4" />
          Invite team member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>
            They&rsquo;ll get a magic link that signs them in as a planner with
            full org access. Share it from your own email — automatic delivery
            isn&rsquo;t wired up yet.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            {result.magic_link ? (
              <div className="space-y-2">
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  Invite ready. Send this link to {email}. It signs them in
                  once and links to their planner account.
                </div>
                <Label>Magic link</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={result.magic_link}
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyMagicLink}
                  >
                    <Copy className="h-4 w-4" />
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="text-[11px] text-amber-700">
                  Email delivery isn&rsquo;t configured — paste this into your
                  email or DM to {name || email}.
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Invite created, but the magic link couldn&rsquo;t be generated.
                Re-invite from Supabase auth.
              </div>
            )}

            {result.warnings.length > 0 && (
              <ul className="space-y-1 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
                {result.warnings.map((w, i) => (
                  <li key={i}>· {w}</li>
                ))}
              </ul>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => reset()}
              >
                Invite another
              </Button>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite_email">Email</Label>
              <Input
                id="invite_email"
                type="email"
                required
                placeholder="planner@yourstudio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite_name">
                Name <span className="text-stone-400">(optional)</span>
              </Label>
              <Input
                id="invite_name"
                placeholder="Jordan"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite_role">Team role</Label>
              <select
                id="invite_role"
                value={role}
                onChange={(e) => setRole(e.target.value as InvitableRole)}
                className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="planner">Planner — full access</option>
                <option value="assistant">Assistant — full access</option>
              </select>
              <p className="text-[11px] text-stone-500">
                For now both roles get full org access. Owner role is
                reserved for the studio founder.
              </p>
            </div>

            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Send invite
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
