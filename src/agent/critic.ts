import { z } from "zod";
import { callStructured, CRITIC_MODEL, type UsageTotals } from "./llm.js";
import { GLOSSARY } from "../context/glossary.js";
import type { ExecResult } from "../db/safeExecute.js";

const Verdict = z.object({
  verdict: z.enum(["approve", "revise"]),
  reason: z.string().describe("Why the query does or does not answer the question as asked."),
});
export type CriticVerdict = z.infer<typeof Verdict>;

const CRITIC_SYSTEM = `You are a skeptical senior data analyst reviewing a colleague's SQL before it is shown to a business user.
The query already executed successfully - syntax is NOT your concern.
Your job is semantic review: does this query actually answer the question that was asked, following the company's glossary and reporting conventions?

Check for:
- Wrong interpretation of ambiguous business terms (the glossary below is authoritative).
- Extra or missing output columns versus what the question asks for.
- Plausible-but-wrong logic: joins that fan out and inflate counts, missing GROUP BY, NULL handling (missing = NULL, not empty string), filters on the wrong column.
- A result that is suspicious for the question (e.g. 0 rows, or NULL where a value is clearly expected).

Approve when the query answers the question as asked. Do not demand stylistic rewrites of a correct query.

${GLOSSARY}`;

function previewResult(result: Extract<ExecResult, { ok: true }>): string {
  const head = result.rows.slice(0, 10);
  return [
    `columns: ${result.columns.join(", ")}`,
    `row count: ${result.rows.length}${result.truncated ? " (truncated at cap)" : ""}`,
    `first rows: ${JSON.stringify(head)}`,
  ].join("\n");
}

/** The verification role: semantic review of a syntactically valid query + its result. */
export async function critique(
  question: string,
  sql: string,
  result: Extract<ExecResult, { ok: true }>,
  usage: UsageTotals,
): Promise<CriticVerdict> {
  return callStructured({
    model: CRITIC_MODEL,
    system: CRITIC_SYSTEM,
    user: `QUESTION: ${question}\n\nPROPOSED SQL:\n${sql}\n\nEXECUTION RESULT:\n${previewResult(result)}`,
    schema: Verdict,
    schemaName: "critic_verdict",
    usage,
  });
}
