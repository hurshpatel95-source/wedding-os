"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  NewClientRequest,
  NewClientResponse,
} from "@/lib/admin-onboarding-types";

export default function NewClientPage() {
  const router = useRouter();
  const [coupleEmail, setCoupleEmail] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [applyPlaybook, setApplyPlaybook] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NewClientResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSubmitting(true);

    const body: NewClientRequest = {
      couple_email: coupleEmail.trim(),
      workspace_name: workspaceName.trim(),
      wedding_date: weddingDate || null,
      apply_playbook: applyPlaybook,
    };

    try {
      const res = await fetch("/api/admin/clients/new", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as
        | NewClientResponse
        | { error: string };
      if (!res.ok || "error" in data) {
        setError(("error" in data && data.error) || "Failed to create client.");
        return;
      }
      setResult(data as NewClientResponse);
    } catch (err) {
      setError((err as Error).message);
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/clients"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to clients
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">New client</CardTitle>
        </CardHeader>
        <CardContent>
          {!result ? (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="couple_email">Couple email</Label>
                <Input
                  id="couple_email"
                  type="email"
                  required
                  placeholder="couple@example.com"
                  value={coupleEmail}
                  onChange={(e) => setCoupleEmail(e.target.value)}
                />
                <p className="text-xs text-stone-500">
                  We&apos;ll create their login and generate a magic link you
                  can share with them.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workspace_name">Workspace name</Label>
                <Input
                  id="workspace_name"
                  required
                  placeholder="Anna & Pete — Italy 2026"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wedding_date">Wedding date (optional)</Label>
                <Input
                  id="wedding_date"
                  type="date"
                  value={weddingDate}
                  onChange={(e) => setWeddingDate(e.target.value)}
                />
              </div>

              <label className="flex items-start gap-3 rounded-md border border-stone-200 bg-stone-50/60 p-3">
                <input
                  type="checkbox"
                  checked={applyPlaybook}
                  onChange={(e) => setApplyPlaybook(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-stone-300"
                />
                <span className="text-sm">
                  <span className="font-medium">
                    Apply default playbook to this client
                  </span>
                  <span className="block text-xs text-stone-500">
                    Copies your studio&apos;s playbook phases + tasks into the
                    new workspace as planning tasks. (Skipped silently if the
                    playbook editor isn&apos;t live yet.)
                  </span>
                </span>
              </label>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={submitting}>
                  {submitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Create workspace
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push("/admin/clients")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Workspace created. Share the magic link below with the couple
                so they can sign in.
              </div>

              {result.magic_link ? (
                <div className="space-y-2">
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
                  <p className="text-xs text-stone-500">
                    The link is single-use. They&apos;ll be redirected to their
                    workspace after sign-in.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Workspace was created, but the magic-link generation failed.
                  Re-invite the couple from Supabase auth or share the login
                  page with them directly.
                </div>
              )}

              {result.warnings.length > 0 && (
                <ul className="space-y-1 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
                  {result.warnings.map((w, i) => (
                    <li key={i}>· {w}</li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setResult(null);
                    setCoupleEmail("");
                    setWorkspaceName("");
                    setWeddingDate("");
                  }}
                >
                  Add another
                </Button>
                <Button
                  type="button"
                  onClick={() => router.push("/admin/clients")}
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
