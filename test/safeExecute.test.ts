import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { connect } from "../src/db/connect.js";
import { safeExecute, MAX_ROWS } from "../src/db/safeExecute.js";
import type Database from "better-sqlite3";

let db: Database.Database;
beforeAll(() => { db = connect(); });
afterAll(() => { db.close(); });

describe("safeExecute", () => {
  it("runs a simple SELECT", () => {
    const r = safeExecute(db, "SELECT COUNT(*) AS c FROM Track");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rows[0][0]).toBe(3503);
  });
  it("allows WITH (CTE) queries", () => {
    const r = safeExecute(db, "WITH t AS (SELECT 1 AS x) SELECT x FROM t");
    expect(r.ok).toBe(true);
  });
  it("rejects INSERT", () => {
    const r = safeExecute(db, "INSERT INTO Artist (Name) VALUES ('x')");
    expect(r.ok).toBe(false);
  });
  it("rejects multi-statement injection", () => {
    const r = safeExecute(db, "SELECT 1; DROP TABLE Artist");
    expect(r.ok).toBe(false);
  });
  it("rejects PRAGMA", () => {
    const r = safeExecute(db, "PRAGMA table_info(Track)");
    expect(r.ok).toBe(false);
  });
  it("rejects statements hidden behind comments", () => {
    const r = safeExecute(db, "SELECT 1 /* x */ ; DELETE FROM Artist");
    expect(r.ok).toBe(false);
  });
  it("returns SQL errors as data, not exceptions", () => {
    const r = safeExecute(db, "SELECT nonexistent_col FROM Track");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no such column/i);
  });
  it("caps result size at MAX_ROWS", () => {
    const r = safeExecute(db, "SELECT TrackId FROM Track");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows.length).toBe(MAX_ROWS);
      expect(r.truncated).toBe(true);
    }
  });
});
