import { describe, expect, test } from "vite-plus/test";
import {
  byName,
  chainedRatio,
  formatNs,
  formatRatio,
  geomean,
  logTicks,
  normaliseToFirst,
  okIntersection,
} from "./stats.ts";
import type { CaseResult } from "./types.ts";

describe("formatNs", () => {
  test("picks ns/µs/ms/s by magnitude", () => {
    expect(formatNs(500)).toBe("500 ns");
    expect(formatNs(1500)).toBe("1.50 µs");
    expect(formatNs(2_500_000)).toBe("2.50 ms");
    expect(formatNs(3_200_000_000)).toBe("3.20 s");
  });
});

describe("formatRatio", () => {
  test("shows × for at-or-above baseline, ÷ for below", () => {
    expect(formatRatio(2)).toBe("2.00×");
    expect(formatRatio(1)).toBe("1.00×");
    expect(formatRatio(0.5)).toBe("÷2.00");
  });
});

describe("geomean", () => {
  test("matches the geometric mean formula", () => {
    expect(geomean([1, 4])).toBeCloseTo(2, 10);
    expect(geomean([2, 8, 4])).toBeCloseTo(4, 10);
  });
  test("empty input is NaN", () => {
    expect(Number.isNaN(geomean([]))).toBe(true);
  });
});

describe("okIntersection", () => {
  const ok = (name: string): CaseResult => ({ name, status: "ok", median: 1 });
  const bad = (name: string): CaseResult => ({ name, status: "unsupported", reason: "x" });

  test("keeps only names ok across every selected system", () => {
    const ts = byName([ok("A"), ok("B")]);
    const rust = byName([ok("A"), bad("B")]);
    const result = okIntersection(
      ["A", "B"],
      new Map([
        ["ts", ts],
        ["rust", rust],
      ]),
      ["ts", "rust"],
    );
    expect(result).toEqual(["A"]);
  });

  test("a missing result counts as not ok", () => {
    const ts = byName([ok("A")]);
    const rust = byName([]);
    const result = okIntersection(
      ["A"],
      new Map([
        ["ts", ts],
        ["rust", rust],
      ]),
      ["ts", "rust"],
    );
    expect(result).toEqual([]);
  });
});

describe("chainedRatio", () => {
  test("the machines cancel through each run's TS", () => {
    // 2x TS on a machine 3x slower, against a baseline that is TS itself: 2x, not 6x.
    expect(chainedRatio(600, 300, 100, 100)).toBeCloseTo(2, 10);
    // A non-TS baseline at 4x TS in its own run: the system at 2x its TS is half as fast.
    expect(chainedRatio(600, 300, 400, 100)).toBeCloseTo(0.5, 10);
  });
});

describe("normaliseToFirst", () => {
  test("divides by the first positive value", () => {
    expect(normaliseToFirst([10, 20, 5])).toEqual([1, 2, 0.5]);
  });
  test("all-NaN when there's no positive value", () => {
    expect(normaliseToFirst([])).toEqual([]);
  });
});

describe("logTicks", () => {
  test("spans lo..hi with 1/2/5 steps", () => {
    const ticks = logTicks(400, 5000);
    expect(ticks[0]).toBeGreaterThanOrEqual(400);
    expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(5000);
    expect(ticks).toContain(1000);
  });
  test("degenerate range falls back to endpoints", () => {
    expect(logTicks(5, 5)).toEqual([5]);
  });
});
