import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "../db/connect.js";
import { introspect, schemaToPrompt } from "../db/introspect.js";
import { safeExecute } from "../db/safeExecute.js";
import { resultsEqual } from "./compareResults.js";
import { runBaseline } from "../agent/baseline.js";
import { runAgent } from "../agent/runAgent.js";
import { newUsage, WRITER_MODEL, CRITIC_MODEL } from "../agent/llm.js";

interface EvalCase {
  id: number;
  difficulty: string;
  question: string;
  gold_sql: string;
  notes?: string;
}

interface CaseResult {
  id: number;
  difficulty: string;
  question: string;
  predictedSql: string;
  validSql: boolean;
  match: boolean;
  approved?: boolean;
  attempts?: number;
  seconds: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  error?: string;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
const RESULTS_DIR = path.join(ROOT, "eval", "results");
const TRAJ_DIR = path.join(RESULTS_DIR, "trajectories");

async function main() {
  const mode = process.argv[2];
  if (mode !== "baseline" && mode !== "agent") {
    console.error("Usage: tsx src/eval/runEval.ts <baseline|agent>");
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.");
    process.exit(1);
  }

  const cases: EvalCase[] = fs
    .readFileSync(path.join(ROOT, "eval", "cases.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));

  const db = connect();
  const schema = schemaToPrompt(introspect(db));
  fs.mkdirSync(TRAJ_DIR, { recursive: true });

  const results: CaseResult[] = [];
  for (const c of cases) {
    const gold = safeExecute(db, c.gold_sql);
    if (!gold.ok) throw new Error(`Gold SQL for case ${c.id} failed: ${gold.error}`);

    process.stdout.write(`[${mode}] case ${c.id} (${c.difficulty}): ${c.question}\n`);
    const t0 = Date.now();
    const usage = newUsage();
    let predictedSql = "";
    let validSql = false;
    let match = false;
    let approved: boolean | undefined;
    let attempts: number | undefined;
    let error: string | undefined;

    try {
      if (mode === "baseline") {
        predictedSql = await runBaseline(c.question, schema, usage);
        const res = safeExecute(db, predictedSql);
        validSql = res.ok;
        if (res.ok) match = resultsEqual(res.rows, gold.rows);
        else error = res.error;
      } else {
        const run = await runAgent(c.question, db, schema);
        predictedSql = run.sql;
        approved = run.approved;
        attempts = run.attempts;
        usage.calls = run.usage.calls;
        usage.inputTokens = run.usage.inputTokens;
        usage.outputTokens = run.usage.outputTokens;
        usage.costUsd = run.usage.costUsd;
        validSql = run.ok && run.result !== null && run.result.ok;
        if (run.ok && run.result?.ok) match = resultsEqual(run.result.rows, gold.rows);
        fs.writeFileSync(
          path.join(TRAJ_DIR, `agent-case-${String(c.id).padStart(2, "0")}.json`),
          JSON.stringify({ case: c, sql: run.sql, approved: run.approved, trajectory: run.trajectory, usage: run.usage }, null, 2),
        );
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    const seconds = (Date.now() - t0) / 1000;
    results.push({
      id: c.id, difficulty: c.difficulty, question: c.question,
      predictedSql, validSql, match, approved, attempts, seconds,
      inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, costUsd: usage.costUsd,
      error,
    });
    process.stdout.write(`   -> ${match ? "MATCH" : "MISS"}${error ? ` (${error})` : ""} in ${seconds.toFixed(1)}s\n`);
  }
  db.close();

  const matches = results.filter((r) => r.match).length;
  const valid = results.filter((r) => r.validSql).length;
  const totalCost = results.reduce((s, r) => s + r.costUsd, 0);
  const totalSeconds = results.reduce((s, r) => s + r.seconds, 0);

  const summary = {
    mode,
    ranAt: new Date().toISOString(),
    models: { writer: WRITER_MODEL, critic: CRITIC_MODEL },
    executionAccuracy: `${matches}/${results.length}`,
    validSqlRate: `${valid}/${results.length}`,
    totalCostUsd: Number(totalCost.toFixed(4)),
    avgSecondsPerCase: Number((totalSeconds / results.length).toFixed(1)),
    results,
  };

  const jsonPath = path.join(RESULTS_DIR, `${mode}-latest.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

  const md = [
    `# Eval results: ${mode}`,
    ``,
    `Ran: ${summary.ranAt} | writer: ${WRITER_MODEL} | critic: ${CRITIC_MODEL}`,
    ``,
    `| Metric | Value |`,
    `|---|---|`,
    `| Execution accuracy (primary) | ${summary.executionAccuracy} |`,
    `| Valid-SQL rate | ${summary.validSqlRate} |`,
    `| Total cost (USD) | $${summary.totalCostUsd} |`,
    `| Avg seconds per case | ${summary.avgSecondsPerCase} |`,
    ``,
    `| # | Difficulty | Match | Valid | Attempts | Cost | Question |`,
    `|---|---|---|---|---|---|---|`,
    ...results.map((r) =>
      `| ${r.id} | ${r.difficulty} | ${r.match ? "YES" : "no"} | ${r.validSql ? "yes" : "NO"} | ${r.attempts ?? 1} | $${r.costUsd.toFixed(4)} | ${r.question} |`,
    ),
  ].join("\n");
  fs.writeFileSync(path.join(RESULTS_DIR, `${mode}-latest.md`), md + "\n");

  console.log(`\n=== ${mode} summary ===`);
  console.log(`Execution accuracy: ${summary.executionAccuracy}`);
  console.log(`Valid-SQL rate:     ${summary.validSqlRate}`);
  console.log(`Total cost:         $${summary.totalCostUsd}`);
  console.log(`Avg latency/case:   ${summary.avgSecondsPerCase}s`);
  console.log(`Saved: ${jsonPath} and ${mode}-latest.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
