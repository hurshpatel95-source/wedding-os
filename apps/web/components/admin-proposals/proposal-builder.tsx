"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ProposalSection, ProposalSectionItem } from "@/lib/tier1-types";

interface WorkspaceLite {
  id: string;
  name: string;
}

interface LeadOption {
  id: string;
  label: string;
}

interface DraftSection extends ProposalSection {
  _id: string;
  items: DraftItem[];
}

interface DraftItem extends ProposalSectionItem {
  _id: string;
}

let _seed = 0;
function nextId(): string {
  _seed += 1;
  return `${Date.now().toString(36)}-${_seed}`;
}

function newItem(): DraftItem {
  return {
    _id: nextId(),
    label: "",
    qty: 1,
    unit_price_eur: 0,
    total_eur: 0,
    optional: false,
  };
}

function newSection(): DraftSection {
  return {
    _id: nextId(),
    title: "",
    body_md: "",
    items: [newItem()],
  };
}

interface InitialProposal {
  id: string;
  title: string;
  intro_md: string | null;
  lead_id: string | null;
  workspace_id: string | null;
  valid_until: string | null;
  sections: ProposalSection[];
}

export function ProposalBuilder({
  workspaces,
  leads,
  initial,
}: {
  workspaces: WorkspaceLite[];
  leads: LeadOption[];
  initial?: InitialProposal;
}) {
  const router = useRouter();
  const isEdit = !!initial;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [linkType, setLinkType] = useState<"none" | "lead" | "workspace">(
    initial?.lead_id ? "lead" : initial?.workspace_id ? "workspace" : "none",
  );
  const [leadId, setLeadId] = useState<string>(initial?.lead_id ?? "");
  const [workspaceId, setWorkspaceId] = useState<string>(
    initial?.workspace_id ?? "",
  );
  const [introMd, setIntroMd] = useState(initial?.intro_md ?? "");
  const [validUntil, setValidUntil] = useState<string>(
    initial?.valid_until ?? "",
  );
  const [sections, setSections] = useState<DraftSection[]>(
    initial && initial.sections.length > 0
      ? initial.sections.map((s) => ({
          _id: nextId(),
          title: s.title,
          body_md: s.body_md ?? "",
          items:
            s.items && s.items.length > 0
              ? s.items.map((it) => ({
                  _id: nextId(),
                  label: it.label,
                  qty: it.qty ?? 1,
                  unit_price_eur: it.unit_price_eur ?? 0,
                  total_eur: it.total_eur ?? 0,
                  optional: !!it.optional,
                  note: it.note,
                }))
              : [newItem()],
        }))
      : [newSection()],
  );
  const [busy, setBusy] = useState(false);

  const grandTotal = useMemo(() => {
    let sum = 0;
    for (const s of sections) {
      for (const it of s.items) {
        const t =
          typeof it.total_eur === "number" && Number.isFinite(it.total_eur)
            ? it.total_eur
            : 0;
        sum += t;
      }
    }
    return sum;
  }, [sections]);

  const updateSection = (id: string, patch: Partial<DraftSection>) => {
    setSections((cur) =>
      cur.map((s) => (s._id === id ? { ...s, ...patch } : s)),
    );
  };

  const updateItem = (
    sectionId: string,
    itemId: string,
    patch: Partial<DraftItem>,
  ) => {
    setSections((cur) =>
      cur.map((s) => {
        if (s._id !== sectionId) return s;
        return {
          ...s,
          items: s.items.map((it) => {
            if (it._id !== itemId) return it;
            const merged: DraftItem = { ...it, ...patch };
            // Auto-recalc total when qty or unit price changes
            if ("qty" in patch || "unit_price_eur" in patch) {
              const qty =
                typeof merged.qty === "number" && Number.isFinite(merged.qty)
                  ? merged.qty
                  : 0;
              const up =
                typeof merged.unit_price_eur === "number" &&
                Number.isFinite(merged.unit_price_eur)
                  ? merged.unit_price_eur
                  : 0;
              merged.total_eur = Number((qty * up).toFixed(2));
            }
            return merged;
          }),
        };
      }),
    );
  };

  const addSection = () => {
    setSections((cur) => [...cur, newSection()]);
  };

  const removeSection = (id: string) => {
    setSections((cur) =>
      cur.length === 1 ? cur : cur.filter((s) => s._id !== id),
    );
  };

  const addItem = (sectionId: string) => {
    setSections((cur) =>
      cur.map((s) =>
        s._id === sectionId ? { ...s, items: [...s.items, newItem()] } : s,
      ),
    );
  };

  const removeItem = (sectionId: string, itemId: string) => {
    setSections((cur) =>
      cur.map((s) => {
        if (s._id !== sectionId) return s;
        if (s.items.length <= 1) return s;
        return { ...s, items: s.items.filter((it) => it._id !== itemId) };
      }),
    );
  };

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Add a title");
      return;
    }
    setBusy(true);
    try {
      const cleanedSections = sections.map((s) => ({
        title: s.title.trim(),
        body_md: s.body_md?.trim() || undefined,
        items: s.items
          .filter((it) => it.label.trim().length > 0)
          .map((it) => ({
            label: it.label.trim(),
            qty: typeof it.qty === "number" ? it.qty : 1,
            unit_price_eur:
              typeof it.unit_price_eur === "number" ? it.unit_price_eur : 0,
            total_eur:
              typeof it.total_eur === "number" ? it.total_eur : 0,
            optional: !!it.optional,
          })),
      }));

      const url = isEdit
        ? `/api/admin/proposals/${initial!.id}`
        : "/api/admin/proposals";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          intro_md: introMd.trim() || null,
          lead_id: linkType === "lead" ? leadId || null : null,
          workspace_id: linkType === "workspace" ? workspaceId || null : null,
          valid_until: validUntil || null,
          sections: cleanedSections,
          total_eur: grandTotal,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(j.error || "Could not save");
      }
      toast.success(isEdit ? "Saved" : "Draft saved");
      const targetId = isEdit ? initial!.id : j.id;
      if (targetId) router.push(`/admin/proposals/${targetId}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
          Basics
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Title" required>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Full-day wedding planning · Sept 2027"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
            />
          </Field>
          <Field label="Valid until">
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
            />
          </Field>
          <Field label="Link to">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={linkType}
                onChange={(e) => {
                  const v = e.target.value as "none" | "lead" | "workspace";
                  setLinkType(v);
                  if (v !== "lead") setLeadId("");
                  if (v !== "workspace") setWorkspaceId("");
                }}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
              >
                <option value="none">Not linked yet</option>
                <option value="lead">Lead</option>
                <option value="workspace">Workspace</option>
              </select>
              {linkType === "lead" && (
                <select
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  className="min-w-[200px] flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
                >
                  <option value="">Pick a lead…</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              )}
              {linkType === "workspace" && (
                <select
                  value={workspaceId}
                  onChange={(e) => setWorkspaceId(e.target.value)}
                  className="min-w-[200px] flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
                >
                  <option value="">Pick a workspace…</option>
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </Field>
          <Field label="Intro (markdown)">
            <textarea
              value={introMd}
              onChange={(e) => setIntroMd(e.target.value)}
              rows={4}
              placeholder="Dear couple, thanks for the lovely chat — here is what we propose for your day…"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Line items
            </div>
            <h2 className="mt-1 font-serif text-2xl font-light tracking-tight">
              Sections
            </h2>
          </div>
          <button
            type="button"
            onClick={addSection}
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900"
          >
            <Plus className="h-3 w-3" />
            Add section
          </button>
        </div>

        {sections.map((s, idx) => (
          <div
            key={s._id}
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[11px] font-medium text-stone-600">
                {idx + 1}
              </div>
              <div className="flex-1 space-y-3">
                <input
                  type="text"
                  value={s.title}
                  onChange={(e) =>
                    updateSection(s._id, { title: e.target.value })
                  }
                  placeholder="Section title (e.g. Planning fee)"
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium focus:border-stone-900 focus:outline-none"
                />
                <textarea
                  value={s.body_md ?? ""}
                  onChange={(e) =>
                    updateSection(s._id, { body_md: e.target.value })
                  }
                  rows={2}
                  placeholder="Optional description (markdown). Leave blank for items-only."
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700 focus:border-stone-900 focus:outline-none"
                />
              </div>
              {sections.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSection(s._id)}
                  className="shrink-0 rounded-full p-1.5 text-stone-400 transition hover:bg-rose-50 hover:text-rose-700"
                  title="Remove section"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-stone-100">
              <table className="w-full text-xs">
                <thead className="bg-stone-50/60 text-[10px] uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="w-16 px-3 py-2 text-right">Qty</th>
                    <th className="w-28 px-3 py-2 text-right">Unit €</th>
                    <th className="w-28 px-3 py-2 text-right">Total €</th>
                    <th className="w-20 px-3 py-2 text-center">Optional</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {s.items.map((it) => (
                    <tr key={it._id}>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={it.label}
                          onChange={(e) =>
                            updateItem(s._id, it._id, { label: e.target.value })
                          }
                          placeholder="Line item label"
                          className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-xs focus:border-stone-300 focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={it.qty ?? 0}
                          onChange={(e) =>
                            updateItem(s._id, it._id, {
                              qty: Number(e.target.value),
                            })
                          }
                          className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-right text-xs tabular-nums focus:border-stone-300 focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={it.unit_price_eur ?? 0}
                          onChange={(e) =>
                            updateItem(s._id, it._id, {
                              unit_price_eur: Number(e.target.value),
                            })
                          }
                          className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-right text-xs tabular-nums focus:border-stone-300 focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-medium tabular-nums text-stone-900">
                        {formatEur(it.total_eur ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!it.optional}
                          onChange={(e) =>
                            updateItem(s._id, it._id, {
                              optional: e.target.checked,
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        {s.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(s._id, it._id)}
                            className="text-stone-400 transition hover:text-rose-700"
                            title="Remove item"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-stone-100 bg-stone-50/40 px-3 py-2">
                <button
                  type="button"
                  onClick={() => addItem(s._id)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 hover:text-stone-900"
                >
                  <Plus className="h-3 w-3" />
                  Add line item
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-900 px-6 py-4 text-white">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-white/60">
            Grand total
          </div>
          <div className="mt-1 font-serif text-3xl font-light tabular-nums">
            {formatEur(grandTotal)}
          </div>
          <div className="text-[10px] text-white/50">
            Includes optional items — they&rsquo;re marked on the client view.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/admin/proposals")}
            className="rounded-full border border-white/30 px-4 py-2 text-xs font-medium text-white/80 transition hover:border-white hover:text-white"
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-full bg-white px-4 py-2 text-xs font-medium text-stone-900 transition hover:bg-stone-100 disabled:opacity-60"
          >
            {busy ? "Saving…" : isEdit ? "Save changes" : "Save draft"}
          </button>
        </div>
      </section>
    </div>
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
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-stone-500">
        {label}
        {required && <span className="ml-0.5 text-rose-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function formatEur(n: number): string {
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `€${n.toFixed(2)}`;
  }
}
