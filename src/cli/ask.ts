import { connect } from "../db/connect.js";
import { introspect, schemaToPrompt } from "../db/introspect.js";
import { runAgent } from "../agent/runAgent.js";

function renderTable(columns: string[], rows: unknown[][]): string {
  const cells = [columns, ...rows.map((r) => r.map((v) => (v === null ? "NULL" : String(v))))];
  const widths = columns.map((_, i) => Math.max(...cells.map((row) => row[i].length)));
  const line = (row: string[]) => "| " + row.map((c, i) => c.padEnd(widths[i])).join(" | ") + " |";
  const sep = "|" + widths.map((w) => "-".repeat(w + 2)).join("|") + "|";
  return [line(columns), sep, ...rows.map((r) => line(r.map((v) => (v === null ? "NULL" : String(v)))))].join("\n");
}

async function main() {
  const question = process.argv.slice(2).join(" ").trim();
  if (!question) {
    console.error('Usage: npm run ask -- "your question about the music store"');
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.");
    process.exit(1);
  }

  const db = connect();
  const schema = schemaToPrompt(introspect(db));
  const run = await runAgent(question, db, schema);
  db.close();

  console.log("\n--- trajectory ---");
  for (const step of run.trajectory) console.log(`[${step.role}] ${step.detail}`);

  if (!run.ok || !run.result?.ok) {
    console.error("\nCould not produce a runnable query for this question.");
    process.exit(1);
  }

  console.log("\n--- SQL (verify before trusting) ---");
  console.log(run.sql);
  if (!run.approved) {
    console.log("\nWARNING: the reviewer did not approve this query within the attempt budget. Treat with extra suspicion.");
  }
  console.log("\n--- result ---");
  console.log(renderTable(run.result.columns, run.result.rows.slice(0, 25)));
  if (run.result.rows.length > 25) console.log(`... ${run.result.rows.length - 25} more row(s)`);
  console.log(`\n(cost: $${run.usage.costUsd.toFixed(4)}, ${run.usage.calls} model call(s), ${run.attempts} attempt(s))`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
