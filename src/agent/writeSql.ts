import { z } from "zod";
import { callStructured, WRITER_MODEL, type UsageTotals } from "./llm.js";
import { GLOSSARY, EXAMPLES } from "../context/glossary.js";

const SqlOut = z.object({
  reasoning: z.string().describe("One or two sentences on how the query answers the question."),
  sql: z.string().describe("A single SQLite SELECT statement."),
});
export type SqlDraft = z.infer<typeof SqlOut>;

const WRITER_SYSTEM = `You are an expert SQLite analyst for a digital music store.
Write a single SQLite SELECT query that answers the user's question.

Rules:
- SQLite dialect only. One statement. Read-only SELECT (or WITH ... SELECT).
- Follow the business glossary and reporting conventions exactly - they define what ambiguous business terms mean in this company and how answers must be shaped.
- Return only the columns the question asks for.

${GLOSSARY}

${EXAMPLES}`;

/**
 * The writer role: drafts SQL. On retries it receives feedback from the
 * executor (a database error) or the critic (a semantic objection).
 */
export async function writeSql(
  question: string,
  schema: string,
  usage: UsageTotals,
  feedback?: { previousSql: string; problem: string },
): Promise<SqlDraft> {
  let user = `DATABASE SCHEMA (SQLite):\n${schema}\n\nQUESTION: ${question}`;
  if (feedback) {
    user += `\n\nYOUR PREVIOUS ATTEMPT:\n${feedback.previousSql}\n\nPROBLEM WITH IT:\n${feedback.problem}\n\nWrite a corrected query.`;
  }
  return callStructured({
    model: WRITER_MODEL,
    system: WRITER_SYSTEM,
    user,
    schema: SqlOut,
    schemaName: "sql_draft",
    usage,
  });
}
