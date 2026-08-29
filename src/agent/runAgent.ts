import type Database from "better-sqlite3";
import { safeExecute, type ExecResult } from "../db/safeExecute.js";
import { writeSql } from "./writeSql.js";
import { critique } from "./critic.js";
import { newUsage, type UsageTotals } from "./llm.js";

export interface TrajectoryStep {
  at: string; // ISO timestamp
  role: "writer" | "executor" | "critic" | "system";
  detail: string;
}

export interface AgentRun {
  ok: boolean;
  sql: string;
  result: ExecResult | null;
  attempts: number;
  approved: boolean;
  trajectory: TrajectoryStep[];
  usage: UsageTotals;
}

const MAX_ATTEMPTS = 4;

/**
 * The agent loop: writer -> executor -> critic, with repair.
 *
 *  - executor feedback fixes queries that don't run (syntax, bad columns)
 *  - critic feedback fixes queries that run but answer the wrong question
 *
 * The loop is bounded at MAX_ATTEMPTS writer calls; if no attempt is
 * approved, the last executable query is returned flagged as unapproved.
 */
export async function runAgent(question: string, db: Database.Database, schema: string): Promise<AgentRun> {
  const usage = newUsage();
  const trajectory: TrajectoryStep[] = [];
  const log = (role: TrajectoryStep["role"], detail: string) =>
    trajectory.push({ at: new Date().toISOString(), role, detail });

  log("system", `question: ${question}`);

  let feedback: { previousSql: string; problem: string } | undefined;
  let lastExecutable: { sql: string; result: ExecResult } | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const draft = await writeSql(question, schema, usage, feedback);
    log("writer", `attempt ${attempt}: ${draft.sql} (reasoning: ${draft.reasoning})`);

    const result = safeExecute(db, draft.sql);
    if (!result.ok) {
      log("executor", `error: ${result.error}`);
      feedback = { previousSql: draft.sql, problem: `The database rejected the query with this error: ${result.error}` };
      continue;
    }
    log("executor", `ok: ${result.rows.length} row(s), columns [${result.columns.join(", ")}]`);
    lastExecutable = { sql: draft.sql, result };

    const verdict = await critique(question, draft.sql, result, usage);
    log("critic", `${verdict.verdict}: ${verdict.reason}`);

    if (verdict.verdict === "approve") {
      return { ok: true, sql: draft.sql, result, attempts: attempt, approved: true, trajectory, usage };
    }
    feedback = { previousSql: draft.sql, problem: `A senior analyst reviewed the query and objected: ${verdict.reason}` };
  }

  // Bounded loop exhausted: return best effort, clearly flagged.
  log("system", "max attempts reached without critic approval; returning last executable query unapproved");
  if (lastExecutable) {
    return { ok: true, sql: lastExecutable.sql, result: lastExecutable.result, attempts: MAX_ATTEMPTS, approved: false, trajectory, usage };
  }
  return { ok: false, sql: "", result: null, attempts: MAX_ATTEMPTS, approved: false, trajectory, usage };
}
