import type Database from "better-sqlite3";

export const MAX_ROWS = 200;

export type ExecResult =
  | { ok: true; columns: string[]; rows: unknown[][]; truncated: boolean }
  | { ok: false; error: string };

/** Strip SQL comments so keyword checks can't be smuggled past in remarks. */
function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
}

const FORBIDDEN = /\b(ATTACH|DETACH|PRAGMA|VACUUM|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|REINDEX|ANALYZE)\b/i;

/**
 * Execute a query with hard safety guarantees:
 *  - DB handle is opened read-only (enforced by SQLite itself)
 *  - single statement, must be SELECT/WITH, forbidden keywords rejected
 *  - result capped at MAX_ROWS rows
 * Errors are returned as data (not thrown) so the agent can read and repair them.
 */
export function safeExecute(db: Database.Database, sql: string): ExecResult {
  const cleaned = stripComments(sql).trim().replace(/;\s*$/, "");

  if (cleaned.length === 0) return { ok: false, error: "Empty SQL statement." };
  if (cleaned.includes(";"))
    return { ok: false, error: "Only a single SQL statement is allowed." };
  if (!/^(SELECT|WITH)\b/i.test(cleaned))
    return { ok: false, error: "Only read-only SELECT queries are allowed. Write operations require human approval and are disabled in this tool." };
  const forbidden = cleaned.match(FORBIDDEN);
  if (forbidden)
    return { ok: false, error: `Forbidden keyword in query: ${forbidden[0].toUpperCase()}.` };

  try {
    const stmt = db.prepare(cleaned);
    if (!stmt.reader)
      return { ok: false, error: "Statement does not return rows; only SELECT queries are allowed." };
    stmt.raw(true);
    const columns = stmt.columns().map((c) => c.name);
    const rows: unknown[][] = [];
    let truncated = false;
    for (const row of stmt.iterate()) {
      if (rows.length >= MAX_ROWS) {
        truncated = true;
        break;
      }
      rows.push(row as unknown[]);
    }
    return { ok: true, columns, rows, truncated };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
