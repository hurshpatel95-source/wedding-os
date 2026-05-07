"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface WorkspaceOption {
  id: string;
  name: string;
}

interface LeadOption {
  id: string;
  name: string;
  email: string | null;
}

type LinkMode = "none" | "workspace" | "lead";

export function ContractDraftForm({
  workspaces,
  leads,
  starterTemplate,
}: {
  workspaces: WorkspaceOption[];
  leads: LeadOption[];
  starterTemplate: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("Wedding Planning Services Agreement");
  const [termsSummary, setTermsSummary] = useState("");
  const [totalEur, setTotalEur] = useState<string>("");
  const [retainerEur, setRetainerEur] = useState<string>("");
  const [retainerDueDate, setRetainerDueDate] = useState<string>("");
  const [linkMode, setLinkMode] = useState<LinkMode>("none");
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [leadId, setLeadId] = useState<string>("");
  const [signerName, setSignerName] = useState<string>("");
  const [signerEmail, setSignerEmail] = useState<string>("");
  const [bodyMd, setBodyMd] = useState(starterTemplate);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === leadId) ?? null,
    [leads, leadId],
  );

  // When the user picks a lead, auto-fill signer fields if empty.
  const handleLeadChange = (id: string) => {
    setLeadId(id);
    const lead = leads.find((l) => l.id === id);
    if (lead) {
      if (!signerName) setSignerName(lead.name);
      if (!signerEmail && lead.email) setSignerEmail(lead.email);
    }
  };

  const handleWorkspaceChange = (id: string) => {
    setWorkspaceId(id);
    const w = workspaces.find((x) => x.id === id);
    if (w && !signerName) setSignerName(w.name);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedBody = bodyMd.trim();
    if (!trimmedTitle || !trimmedBody) {
      setError("Title and body are required.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: trimmedTitle,
        body_md: trimmedBody,
        terms_summary: termsSummary.trim() || null,
        total_eur: totalEur ? Number(totalEur) : null,
        retainer_eur: retainerEur ? Number(retainerEur) : null,
        retainer_due_date: retainerDueDate || null,
        workspace_id: linkMode === "workspace" && workspaceId ? workspaceId : null,
        lead_id: linkMode === "lead" && leadId ? leadId : null,
        signer_name: signerName.trim() || null,
        signer_email: signerEmail.trim() || null,
      };
      const res = await fetch("/api/admin/contracts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !json.id) {
        setError(json.error ?? "Couldn't create the contract.");
        setSubmitting(false);
        return;
      }
      router.push(`/admin/contracts/${json.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-6 lg:grid-cols-[2fr_1fr]"
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <Field label="Title" required>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Wedding Planning Services Agreement"
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
            />
          </Field>

          <Field label="One-line summary (optional)">
            <input
              value={termsSummary}
              onChange={(e) => setTermsSummary(e.target.value)}
              placeholder='e.g. "Full planning, June 2027 in Sicily"'
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
            />
          </Field>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="font-serif text-lg">Body</h3>
            <span className="text-[10px] uppercase tracking-wider text-stone-400">
              Markdown supported
            </span>
          </div>
          <textarea
            value={bodyMd}
            onChange={(e) => setBodyMd(e.target.value)}
            required
            rows={20}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 font-mono text-xs leading-relaxed focus:border-stone-900 focus:outline-none"
          />
          <p className="mt-2 text-[11px] text-stone-500">
            Tip: replace the placeholders ({"{Studio Name}"}, {"{Couple Names}"},
            {" {Total}"}, {"{Retainer}"}) with the real values before sending.
          </p>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="font-serif text-lg">Pricing</h3>
          <Field label="Total fee (€)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={totalEur}
              onChange={(e) => setTotalEur(e.target.value)}
              placeholder="12000"
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm tabular-nums focus:border-stone-900 focus:outline-none"
            />
          </Field>
          <Field label="Retainer (€)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={retainerEur}
              onChange={(e) => setRetainerEur(e.target.value)}
              placeholder="6000"
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm tabular-nums focus:border-stone-900 focus:outline-none"
            />
          </Field>
          <Field label="Retainer due date">
            <input
              type="date"
              value={retainerDueDate}
              onChange={(e) => setRetainerDueDate(e.target.value)}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
            />
          </Field>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="font-serif text-lg">Link to</h3>
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {(
              [
                { v: "none", label: "Standalone" },
                { v: "workspace", label: "Client workspace" },
                { v: "lead", label: "Lead" },
              ] as { v: LinkMode; label: string }[]
            ).map((opt) => {
              const active = linkMode === opt.v;
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setLinkMode(opt.v)}
                  className={`rounded-full border px-3 py-1 transition ${
                    active
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {linkMode === "workspace" && (
            <Field label="Workspace">
              <select
                value={workspaceId}
                onChange={(e) => handleWorkspaceChange(e.target.value)}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
              >
                <option value="">Select a workspace…</option>
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {linkMode === "lead" && (
            <Field label="Lead">
              <select
                value={leadId}
                onChange={(e) => handleLeadChange(e.target.value)}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
              >
                <option value="">Select a lead…</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.email ? ` · ${l.email}` : ""}
                  </option>
                ))}
              </select>
              {selectedLead?.email === null && (
                <p className="mt-1 text-[11px] text-amber-700">
                  This lead has no email — you&rsquo;ll need to type one below
                  before sending.
                </p>
              )}
            </Field>
          )}
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="font-serif text-lg">Signer</h3>
          <Field label="Name">
            <input
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Nisha & Hursh"
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
              placeholder="couple@example.com"
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
            />
          </Field>
          <p className="mt-1 text-[11px] text-stone-500">
            Required before you can send. The sign link goes to this address.
          </p>
        </section>

        <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
          {error && (
            <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving draft…
              </>
            ) : (
              "Save draft"
            )}
          </button>
          <p className="mt-2 text-center text-[11px] text-stone-500">
            We won&rsquo;t send anything yet — you can review before sending.
          </p>
        </div>
      </aside>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-3 block text-sm">
      <span className="text-[11px] uppercase tracking-wider text-stone-500">
        {label}
        {required && <span className="ml-0.5 text-rose-600">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
