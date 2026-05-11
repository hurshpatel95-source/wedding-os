// Write-guard helper — Stabilization Sprint T1.3
//
// The May 8 /settings/preferences regression: the API ran
// `supabase.from("workspaces").update(patch).eq("id", wsId)`, the
// query succeeded with 0 rows affected (RLS blocked the update for
// couple-role users), the API returned 200, the toast said "Saved."
// — but nothing actually saved. The user reloaded, saw their date
// reverted, and lost trust.
//
// This helper makes that failure class impossible. Every mutation
// wraps in a guard that asserts:
//   1. No DB error
//   2. At least 1 row affected (UPDATE/DELETE) or returned (INSERT)
//   3. If either fails, throws DbWriteError with context
//
// Use:
//   const updated = await dbUpdate(
//     "update workspace preferences",
//     supabase.from("workspaces").update(patch).eq("id", wsId).select("id"),
//   );

export class DbWriteError extends Error {
  constructor(
    public description: string,
    public reason: string,
    public details?: unknown,
  ) {
    super(`DB write failed (${description}): ${reason}`);
    this.name = "DbWriteError";
  }
}

interface SupabaseResult<T> {
  data: T[] | null;
  error: { message: string; code?: string; details?: string } | null;
}

/**
 * Wrap an UPDATE / DELETE query. Asserts no DB error AND at least 1
 * row affected. Returns the affected rows (with whatever columns
 * you `.select()`-ed).
 *
 * Pattern:
 *   const rows = await dbUpdate(
 *     "update workspace.wedding_date",
 *     supabase.from("workspaces").update({ wedding_date }).eq("id", wsId).select("id"),
 *   );
 *   // rows is guaranteed non-empty; rows[0] is the updated row
 */
export async function dbUpdate<T>(
  description: string,
  query: PromiseLike<SupabaseResult<T>>,
): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    throw new DbWriteError(description, error.message, error);
  }
  if (!data || data.length === 0) {
    throw new DbWriteError(
      description,
      "0 rows affected — RLS may have blocked the write, or the WHERE clause matched no rows",
    );
  }
  return data;
}

/**
 * Wrap an INSERT query. Asserts no DB error AND at least 1 row
 * returned. Use `.select("...")` on the insert to populate the
 * returned data. Returns the inserted rows.
 *
 * Pattern:
 *   const inserted = await dbInsert(
 *     "create budget_line",
 *     supabase.from("budget_lines").insert(row).select("id"),
 *   );
 */
export async function dbInsert<T>(
  description: string,
  query: PromiseLike<SupabaseResult<T>>,
): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    throw new DbWriteError(description, error.message, error);
  }
  if (!data || data.length === 0) {
    throw new DbWriteError(
      description,
      "Insert returned no rows — did you forget to .select() after .insert()?",
    );
  }
  return data;
}

/**
 * Wrap a DELETE query. Asserts no DB error AND at least 1 row
 * affected. Returns the deleted rows.
 *
 * Pattern:
 *   await dbDelete(
 *     "remove vendor",
 *     supabase.from("vendors").delete().eq("id", vendorId).select("id"),
 *   );
 */
export async function dbDelete<T>(
  description: string,
  query: PromiseLike<SupabaseResult<T>>,
): Promise<T[]> {
  return dbUpdate(description, query);
}

/**
 * For pre-validation: surface a DbWriteError as a NextResponse-safe
 * structure that API endpoints can return without leaking internal
 * error details to the client.
 */
export function dbWriteErrorResponse(
  err: unknown,
): { status: number; body: { error: string } } {
  if (err instanceof DbWriteError) {
    const isZeroRows = err.reason.includes("0 rows affected");
    return {
      status: isZeroRows ? 403 : 500,
      body: { error: err.message },
    };
  }
  return {
    status: 500,
    body: { error: "Internal server error" },
  };
}
