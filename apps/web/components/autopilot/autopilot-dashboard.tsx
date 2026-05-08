"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Mail,
  Plane,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertCard } from "./alert-card";
import { VendorPipeline } from "./vendor-pipeline";
import type {
  AlertRow,
  AlertSeverity,
  AutopilotRunRow,
  GmailConnectionRow,
} from "@/lib/autopilot-types";
import type { AutopilotVendor } from "@/app/(app)/autopilot/page";

// Severity ordering for "today's queue" — urgent first, then warn, then
// the rest in chronological order.
const SEVERITY_RANK: Record<AlertSeverity, number> = {
  urgent: 0,
  warn: 1,
  info: 2,
  success: 3,
};

export function AutopilotDashboard({
  alerts,
  vendors,
  gmailStatus,
  runs,
}: {
  alerts: AlertRow[];
  vendors: AutopilotVendor[];
  gmailStatus: GmailConnectionRow | null;
  runs: AutopilotRunRow[];
}) {
  const queue = [...alerts]
    .sort((a, b) => {
      const r = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (r !== 0) return r;
      return a.created_at < b.created_at ? 1 : -1;
    })
    .slice(0, 5);

  const totalUnread = alerts.filter((a) => a.read_at === null).length;

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section>
        <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-stone-500">
          <Plane className="h-3.5 w-3.5" />
          Autopilot
        </div>
        <h1 className="font-serif text-4xl font-light leading-[1.05] tracking-tight md:text-5xl">
          Today&apos;s queue
          {totalUnread > 0 && (
            <span className="ml-3 align-middle text-base font-normal text-stone-500">
              {totalUnread} unread
            </span>
          )}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-600">
          The latest things your AI co-pilot has surfaced — vendor replies,
          quote moves, follow-ups it&apos;s about to send. Tap to handle.
        </p>
      </section>

      {/* Today's queue cards */}
      <section>
        {queue.length === 0 ? (
          <EmptyQueue hasVendors={vendors.length > 0} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {queue.map((a) => (
              <AlertCard key={a.id} alert={a} variant="full" />
            ))}
          </div>
        )}
      </section>

      {/* Vendor pipeline */}
      <section>
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-[0.25em] text-stone-500">
              Vendor pipeline
            </div>
            <h2 className="font-serif text-3xl font-light tracking-tight">
              Where every vendor stands
            </h2>
          </div>
          <Link
            href="/vendors"
            className="flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <VendorPipeline vendors={vendors} />
      </section>

      {/* Connections */}
      <section>
        <div className="mb-4 text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Connections
        </div>
        <GmailConnectionCard status={gmailStatus} />
      </section>

      {/* Recent activity */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Recent autopilot activity
          </div>
          {runs.length > 0 && (
            <span className="text-[11px] text-stone-500">
              Last {runs.length}
            </span>
          )}
        </div>
        <ActivityFeed runs={runs} />
      </section>
    </div>
  );
}

function EmptyQueue({ hasVendors }: { hasVendors: boolean }) {
  if (!hasVendors) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white/50 px-6 py-16 text-center">
        <Sparkles className="mx-auto mb-3 h-8 w-8 text-stone-300" />
        <p className="font-serif text-xl text-stone-700">
          No vendors yet
        </p>
        <p className="mt-2 text-sm text-stone-500">
          Find your first vendor and Autopilot will start surfacing replies,
          quotes, and follow-ups here.
        </p>
        <div className="mt-5">
          <Button asChild>
            <Link href="/vendors/find">
              Find your first vendor <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 px-6 py-10 text-center">
      <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-600" />
      <p className="font-serif text-xl text-stone-800">All caught up</p>
      <p className="mt-2 text-sm text-stone-600">
        Nothing waiting on you right now. Autopilot will ping you the moment
        something needs a tap.
      </p>
    </div>
  );
}

function GmailConnectionCard({
  status,
}: {
  status: GmailConnectionRow | null;
}) {
  const isConnected = status?.status === "active";
  const lastSync = status?.last_synced_at;
  const lastSyncLabel = (() => {
    if (!lastSync) return null;
    try {
      return formatDistanceToNow(new Date(lastSync), { addSuffix: true });
    } catch {
      return null;
    }
  })();

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100">
            <Mail className="h-4 w-4 text-stone-700" />
          </div>
          <div>
            <div className="font-medium">Wedding Gmail</div>
            <div className="text-xs text-stone-500">
              {status?.email
                ? status.email
                : "Connect your wedding-only inbox so Autopilot can read replies and draft responses."}
            </div>
            {isConnected && lastSyncLabel && (
              <div className="mt-0.5 text-[11px] text-stone-400">
                Last synced {lastSyncLabel}
              </div>
            )}
            {status && !isConnected && status.last_error && (
              <div className="mt-0.5 text-[11px] text-rose-700">
                Error: {status.last_error}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Connected
            </span>
          ) : (
            <Button asChild variant="default" size="sm">
              <Link href="/settings/gmail">
                {status ? "Reconnect" : "Connect"}
              </Link>
            </Button>
          )}
          {isConnected && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/settings/gmail">Manage</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityFeed({ runs }: { runs: AutopilotRunRow[] }) {
  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-white/40 px-5 py-8 text-center text-sm text-stone-500">
        Autopilot hasn&apos;t run yet. As soon as a vendor replies or you draft
        outreach, the trace appears here.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-stone-200/60 rounded-xl border border-stone-200 bg-white shadow-sm">
      {runs.map((r) => {
        const ts = (() => {
          try {
            return formatDistanceToNow(new Date(r.created_at), {
              addSuffix: true,
            });
          } catch {
            return "";
          }
        })();
        const cost =
          r.cost_usd && Number(r.cost_usd) > 0
            ? `$${Number(r.cost_usd).toFixed(4)}`
            : null;
        return (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100">
              <Activity className="h-3.5 w-3.5 text-stone-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-stone-800">
                {humanKind(r.kind)}
              </div>
              <div className="truncate text-[11px] text-stone-500">
                {[r.triggered_by, r.model, ts].filter(Boolean).join(" · ")}
              </div>
            </div>
            {cost && (
              <span className="shrink-0 text-[11px] text-stone-500">
                {cost}
              </span>
            )}
            <StatusPill status={r.status} />
          </li>
        );
      })}
    </ul>
  );
}

function humanKind(k: string): string {
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function StatusPill({ status }: { status: AutopilotRunRow["status"] }) {
  const cls =
    status === "success"
      ? "bg-emerald-100 text-emerald-800"
      : status === "failed"
        ? "bg-rose-100 text-rose-800"
        : status === "running"
          ? "bg-sky-100 text-sky-800"
          : "bg-stone-100 text-stone-700";
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {status}
    </span>
  );
}
