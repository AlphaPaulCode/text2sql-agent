import { z } from "zod";
import { callStructured, WRITER_MODEL, type UsageTotals } from "./llm.js";

const SqlOut = z.object({ sql: z.string() });

/**
 * The simple baseline: one direct prompt with the schema and the question.
 * No execution, no repair, no critic, no glossary. This represents the
 * reasonable "just ask an LLM for the SQL" approach the agent is measured against.
 */
export async function runBaseline(
  question: string,
  schema: string,
  usage: UsageTotals,
): Promise<string> {
  const out = await callStructured({
    model: WRITER_MODEL,
    system:
      "You are an expert SQLite analyst. Given a database schema and a question, respond with a single SQLite SELECT query that answers the question.",
    user: `DATABASE SCHEMA (SQLite):\n${schema}\n\nQUESTION: ${question}`,
    schema: SqlOut,
    schemaName: "sql_query",
    usage,
  });
  return out.sql;
}
