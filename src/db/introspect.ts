import type Database from "better-sqlite3";

export interface TableInfo {
  name: string;
  ddl: string;
  rowCount: number;
}

/** Compact, LLM-friendly schema description: DDL per table + row counts. */
export function introspect(db: Database.Database): TableInfo[] {
  const tables = db
    .prepare(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as { name: string; sql: string }[];

  return tables.map((t) => ({
    name: t.name,
    // collapse whitespace so the DDL is compact in the prompt
    ddl: t.sql.replace(/\s+/g, " ").trim(),
    rowCount: (db.prepare(`SELECT COUNT(*) AS c FROM "${t.name}"`).get() as { c: number }).c,
  }));
}

export function schemaToPrompt(tables: TableInfo[]): string {
  return tables
    .map((t) => `-- ${t.name} (${t.rowCount} rows)\n${t.ddl};`)
    .join("\n\n");
}
