"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  BUDGET_BANDS,
  LEAD_SOURCE_LABEL,
  type LeadSource,
} from "@/lib/lead-types";
import type { LeadRoutingRuleRow } from "@/lib/wave2-types";

const SOURCES: LeadSource[] = [
  "booking_page",
  "public_wedding_site",
  "manual",
  "referral",
];

interface TeamMember {
  id: string;
  email: string | null;
  full_name: string | null;
}

interface Props {
  mode: "new" | "edit";
  ruleId?: string;
  team: TeamMember[];
  initial?: Partial<LeadRoutingRuleRow>;
}

export function RuleEditorForm({ mode, ruleId, team, initial }: Props) {
  const router = useRouter();
  const initialConds = initial?.match_conditions ?? {};

  const [name, setName] = useState(initial?.name ?? "");
  const [priority, setPriority] = useState<number>(initial?.priority ?? 100);
  const [enabled, setEnabled] = useState<boolean>(initial?.enabled ?? true);
  const [assigneeId, setAssigneeId] = useState<string>(
    initial?.assignee_user_id ?? team[0]?.id ?? "",
  );

  const [sources, setSources] = useState<Set<string>>(
    new Set(initialConds.source ?? []),
  );
  const [bands, setBands] = useState<Set<string>>(
    new Set(initialConds.budget_band ?? []),
  );
  const [cityText, setCityText] = useState<string>(
    (initialConds.city_or_region_contains ?? []).join(", "),
  );
  const [guestMin, setGuestMin] = useState<string>(
    initialConds.guest_count_min !== undefined
      ? String(initialConds.guest_count_min)
      : "",
  );
  const [guestMax, setGuestMax] = useState<string>(
    initialConds.guest_count_max !== undefined
      ? String(initialConds.guest_count_max)
      : "",
  );

  const [busy, setBusy] = useState(false);

  const teamLabel = useMemo(
    () =>
      new Map(
        team.map(
          (m) =>
            [m.id, m.full_name?.trim() || m.email || "Team member"] as const,
        ),
      ),
    [team],
  );

  const toggleSet = (s: Set<string>, value: string): Set<string> => {
    const next = new Set(s);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Give this rule a name");
      return;
    }
    if (!assigneeId) {
      toast.error("Pick a team member to assign matches to");
      return;
    }

    const cities = cityText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const minN = guestMin === "" ? undefined : Number(guestMin);
    const maxN = guestMax === "" ? undefined : Number(guestMax);
    if (
      typeof minN === "number" &&
      typeof maxN === "number" &&
      Number.isFinite(minN) &&
      Number.isFinite(maxN) &&
      minN > maxN
    ) {
      toast.error("Min guests cannot be greater than max guests");
      return;
    }

    const match_conditions: Record<string, unknown> = {};
    if (sources.size > 0) match_conditions.source = Array.from(sources);
    if (bands.size > 0) match_conditions.budget_band = Array.from(bands);
    if (cities.length > 0) match_conditions.city_or_region_contains = cities;
    if (typeof minN === "number" && Number.isFinite(minN)) {
      match_conditions.guest_count_min = minN;
    }
    if (typeof maxN === "number" && Number.isFinite(maxN)) {
      match_conditions.guest_count_max = maxN;
    }

    const payload = {
      name: name.trim(),
      priority,
      enabled,
      assignee_user_id: assigneeId,
      match_conditions,
    };

    setBusy(true);
    try {
      const url =
        mode === "new"
          ? "/api/admin/lead-routing-rules"
          : `/api/admin/lead-routing-rules/${ruleId}`;
      const res = await fetch(url, {
        method: mode === "new" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not save");
      }
      toast.success(mode === "new" ? "Rule created" : "Rule updated");
      router.push("/admin/settings/lead-routing");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/settings/lead-routing"
          className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to routing rules
        </Link>
      </div>

      <header>
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Lead routing
        </div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
          {mode === "new" ? "New routing rule" : "Edit routing rule"}
        </h1>
      </header>

      <section className="space-y-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Rule name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="High-budget Barcelona inquiries → Astha"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Priority" hint="Lower number = runs first">
            <input
              type="number"
              min={0}
              max={10000}
              value={priority}
              onChange={(e) =>
                setPriority(Math.max(0, Number(e.target.value) || 0))
              }
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm tabular-nums"
            />
          </Field>
        </div>

        <Field label="Sources to match" hint="Leave all unchecked to match any source">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SOURCES.map((s) => (
              <label
                key={s}
                className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50/60 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={sources.has(s)}
                  onChange={() => setSources((v) => toggleSet(v, s))}
                />
                <span>{LEAD_SOURCE_LABEL[s]}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-stone-400">
                  {s}
                </span>
              </label>
            ))}
          </div>
        </Field>

        <Field label="Budget bands to match" hint="Leave all unchecked to match any budget">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {BUDGET_BANDS.map((b) => (
              <label
                key={b}
                className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50/60 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={bands.has(b)}
                  onChange={() => setBands((v) => toggleSet(v, b))}
                />
                <span>{b}</span>
              </label>
            ))}
          </div>
        </Field>

        <Field
          label="City / region contains"
          hint="Comma-separated. Case-insensitive substring; ANY needle matches."
        >
          <input
            type="text"
            value={cityText}
            onChange={(e) => setCityText(e.target.value)}
            placeholder="Barcelona, Costa Brava, Mallorca"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Min guest count" hint="Optional">
            <input
              type="number"
              min={0}
              max={5000}
              value={guestMin}
              onChange={(e) => setGuestMin(e.target.value)}
              placeholder="e.g. 100"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm tabular-nums"
            />
          </Field>
          <Field label="Max guest count" hint="Optional">
            <input
              type="number"
              min={0}
              max={5000}
              value={guestMax}
              onChange={(e) => setGuestMax(e.target.value)}
              placeholder="e.g. 250"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm tabular-nums"
            />
          </Field>
        </div>

        <Field label="Assign matched leads to">
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
          >
            {team.length === 0 ? (
              <option value="">No team members available</option>
            ) : (
              team.map((m) => (
                <option key={m.id} value={m.id}>
                  {teamLabel.get(m.id)}
                </option>
              ))
            )}
          </select>
        </Field>

        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Rule is enabled
        </label>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-stone-100 pt-5">
          <Link
            href="/admin/settings/lead-routing"
            className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white px-5 py-2 text-sm font-medium text-stone-800 transition hover:border-stone-500"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={submit}
            disabled={busy || team.length === 0}
            className="inline-flex items-center justify-center rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
          >
            {busy ? "Saving…" : mode === "new" ? "Create rule" : "Save rule"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
          {label}
        </span>
        {hint && <span className="text-[10px] text-stone-400">{hint}</span>}
      </div>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
