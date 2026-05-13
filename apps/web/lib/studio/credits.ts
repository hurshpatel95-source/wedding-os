// AI Studio — credit ledger.
//
// TEMPORARY in-memory ledger. Resets on Railway redeploy. Will be
// replaced by the `credit_ledger` table once T1.1 part 2 activates and
// the queued migration `20260513000001_credit_ledger.sql` applies.
//
// Until then: module-level Map keyed on workspace_id, default 25 credits
// per new workspace. Atomic spend / grant. Concurrent generations within
// one server process are safe (single-threaded JS event loop), but two
// workspaces hitting two Railway replicas at the exact same moment will
// each see their own copy of the Map — that's fine for the Day-1 demo
// surface; the ledger migration is the durable answer.
//
// API:
//   getBalance(workspaceId)
//   spend(workspaceId, amount, reason) — atomic check + decrement
//   grant(workspaceId, amount, reason) — credit top-up

import "server-only";

const DEFAULT_STARTING_BALANCE = 25;

interface LedgerEntry {
  balance: number;
  /** Recent transactions — capped so the in-memory state doesn't leak. */
  log: Array<{ at: string; delta: number; reason: string; balance_after: number }>;
}

const LEDGER = new Map<string, LedgerEntry>();
const MAX_LOG_ENTRIES = 50;

function ensureEntry(workspaceId: string): LedgerEntry {
  let entry = LEDGER.get(workspaceId);
  if (!entry) {
    entry = { balance: DEFAULT_STARTING_BALANCE, log: [] };
    LEDGER.set(workspaceId, entry);
  }
  return entry;
}

function appendLog(
  entry: LedgerEntry,
  delta: number,
  reason: string,
): void {
  entry.log.push({
    at: new Date().toISOString(),
    delta,
    reason,
    balance_after: entry.balance,
  });
  if (entry.log.length > MAX_LOG_ENTRIES) {
    entry.log.splice(0, entry.log.length - MAX_LOG_ENTRIES);
  }
}

export async function getBalance(workspaceId: string): Promise<number> {
  return ensureEntry(workspaceId).balance;
}

export async function spend(
  workspaceId: string,
  amount: number,
  reason: string,
): Promise<{ ok: boolean; balance: number; insufficient?: true }> {
  if (amount <= 0) {
    return { ok: false, balance: ensureEntry(workspaceId).balance };
  }
  const entry = ensureEntry(workspaceId);
  if (entry.balance < amount) {
    return {
      ok: false,
      balance: entry.balance,
      insufficient: true,
    };
  }
  entry.balance -= amount;
  appendLog(entry, -amount, reason);
  return { ok: true, balance: entry.balance };
}

export async function grant(
  workspaceId: string,
  amount: number,
  reason: string,
): Promise<{ balance: number }> {
  if (amount <= 0) {
    return { balance: ensureEntry(workspaceId).balance };
  }
  const entry = ensureEntry(workspaceId);
  entry.balance += amount;
  appendLog(entry, amount, reason);
  return { balance: entry.balance };
}

/**
 * Inspection helper — used by the /studio hub to show recent history.
 * NOT public API yet (no UI consumes it).
 */
export async function getLog(
  workspaceId: string,
): Promise<LedgerEntry["log"]> {
  return [...ensureEntry(workspaceId).log].reverse();
}
