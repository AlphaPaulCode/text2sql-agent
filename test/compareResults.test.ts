import { describe, it, expect } from "vitest";
import { resultsEqual } from "../src/eval/compareResults.js";

describe("resultsEqual", () => {
  it("matches identical single-value results", () => {
    expect(resultsEqual([[3503]], [[3503]])).toBe(true);
  });
  it("treats numeric strings and numbers as equal", () => {
    expect(resultsEqual([["42"]], [[42]])).toBe(true);
    expect(resultsEqual([["3.50"]], [[3.5]])).toBe(true);
  });
  it("ignores row order", () => {
    expect(resultsEqual([["a"], ["b"]], [["b"], ["a"]])).toBe(true);
  });
  it("ignores column order", () => {
    expect(resultsEqual([["Rock", 100]], [[100, "Rock"]])).toBe(true);
  });
  it("rounds floats to 4 decimal places", () => {
    expect(resultsEqual([[5.6800000001]], [[5.68]])).toBe(true);
    expect(resultsEqual([[5.681]], [[5.68]])).toBe(false);
  });
  it("folds negative zero", () => {
    expect(resultsEqual([[-0]], [[0]])).toBe(true);
  });
  it("distinguishes NULL from empty string and zero", () => {
    expect(resultsEqual([[null]], [[""]])).toBe(false);
    expect(resultsEqual([[null]], [[0]])).toBe(false);
    expect(resultsEqual([[null]], [[null]])).toBe(true);
  });
  it("detects differing multiset counts", () => {
    expect(resultsEqual([["a"], ["a"]], [["a"]])).toBe(false);
  });
  it("detects wrong values", () => {
    expect(resultsEqual([[59]], [[58]])).toBe(false);
  });
  it("handles empty results", () => {
    expect(resultsEqual([], [])).toBe(true);
    expect(resultsEqual([], [[1]])).toBe(false);
  });
});
