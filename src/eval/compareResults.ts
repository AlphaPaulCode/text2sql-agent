/**
 * Execution accuracy comparator.
 *
 * Two result sets are "equal" when they contain the same multiset of rows,
 * ignoring row order and column order. Each cell is normalized first:
 * floats rounded to 4 dp, -0 folded into 0, NULL made explicit, buffers hexed.
 *
 * Column order is neutralized by sorting the normalized cells *within* each
 * row. That trades a tiny false-positive risk (two columns whose values are
 * swapped row-wise) for robustness to SELECT-list ordering -- acceptable here
 * because gold queries are authored to keep row shapes unambiguous.
 */

function normalizeValue(v: unknown): string {
  if (v === null || v === undefined) return "<NULL>";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v === 0 ? 0 : v);
    const r = Math.round(v * 1e4) / 1e4;
    return String(r === 0 ? 0 : r);
  }
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Buffer) return "0x" + v.toString("hex");
  const s = String(v).trim();
  // numeric strings compare as numbers ("42" vs 42, "3.50" vs 3.5)
  if (s !== "" && !Number.isNaN(Number(s))) return normalizeValue(Number(s));
  return s;
}

export function canonicalize(rows: unknown[][]): string[] {
  return rows.map((row) => row.map(normalizeValue).sort().join("|")).sort();
}

export function resultsEqual(a: unknown[][], b: unknown[][]): boolean {
  const ca = canonicalize(a);
  const cb = canonicalize(b);
  if (ca.length !== cb.length) return false;
  return ca.every((row, i) => row === cb[i]);
}
