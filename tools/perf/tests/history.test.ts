import { expect, test } from "vite-plus/test";
import {
  appendRun,
  detectDrift,
  median,
  slowestFiles,
  trimHistory,
  type History,
  type RunRecord,
} from "../src/history.ts";

test("median: odd and even counts, and the empty case", () => {
  expect(median([3, 1, 2])).toBe(2);
  expect(median([1, 2, 3, 4])).toBe(2.5);
  expect(median([5])).toBe(5);
  expect(Number.isNaN(median([]))).toBe(true);
});

test("median is order-independent", () => {
  expect(median([10, 1, 5, 3, 8])).toBe(median([1, 3, 5, 8, 10]));
});

test("trimHistory keeps only the most recent N runs", () => {
  const history: History = {
    runs: Array.from({ length: 5 }, (_, i) => ({ sha: `sha${i}`, date: `d${i}`, packages: {} })),
  };
  const trimmed = trimHistory(history, 2);
  expect(trimmed.runs.map((r) => r.sha)).toEqual(["sha3", "sha4"]);
});

test("trimHistory is a no-op under the cap", () => {
  const history: History = { runs: [{ sha: "a", date: "d", packages: {} }] };
  expect(trimHistory(history, 60)).toEqual(history);
});

test("appendRun adds the run and enforces the cap in one step", () => {
  const history: History = {
    runs: [
      { sha: "a", date: "d0", packages: {} },
      { sha: "b", date: "d1", packages: {} },
    ],
  };
  const next = appendRun(history, { sha: "c", date: "d2", packages: {} }, 2);
  expect(next.runs.map((r) => r.sha)).toEqual(["b", "c"]);
});

function runWith(pkg: string, file: string, testName: string, durationMs: number): RunRecord {
  return {
    sha: "current",
    date: "now",
    packages: {
      [pkg]: {
        wallMs: durationMs,
        files: { [file]: durationMs },
        tests: [{ file, name: testName, durationMs }],
      },
    },
  };
}

test("detectDrift needs at least minPriorRuns before it will flag anything", () => {
  // Only 4 priors — one short of the default floor of 5 — so even a wild outlier is silent.
  const priorHistory: History = {
    runs: [100, 100, 100, 100].map((ms, i) => ({
      ...runWith("@e/pkg", "a.test.ts", "slow test", ms),
      sha: `p${i}`,
    })),
  };
  const current = runWith("@e/pkg", "a.test.ts", "slow test", 10_000);
  expect(detectDrift(current, priorHistory)).toEqual([]);
});

test("detectDrift flags a test past both the ratio and absolute thresholds", () => {
  const priorHistory: History = {
    runs: [98, 100, 102, 99, 101].map((ms, i) => ({
      ...runWith("@e/pkg", "a.test.ts", "slow test", ms),
      sha: `p${i}`,
    })),
  };
  const current = runWith("@e/pkg", "a.test.ts", "slow test", 500); // 5x median, +400ms
  const drift = detectDrift(current, priorHistory);
  expect(drift).toEqual([
    {
      package: "@e/pkg",
      file: "a.test.ts",
      test: "slow test",
      currentMs: 500,
      medianMs: 100,
      ratio: 5,
      absDiffMs: 400,
      priorRuns: 5,
    },
  ]);
});

test("detectDrift requires BOTH thresholds — a big ratio on a tiny test doesn't count", () => {
  const priorHistory: History = {
    runs: [1, 1, 1, 1, 1].map((ms, i) => ({
      ...runWith("@e/pkg", "a.test.ts", "tiny test", ms),
      sha: `p${i}`,
    })),
  };
  // 10x the median, but only +9ms absolute — below the 200ms floor.
  const current = runWith("@e/pkg", "a.test.ts", "tiny test", 10);
  expect(detectDrift(current, priorHistory)).toEqual([]);
});

test("detectDrift requires BOTH thresholds — a big absolute jump on a huge test doesn't count", () => {
  const priorHistory: History = {
    runs: [10_000, 10_000, 10_000, 10_000, 10_000].map((ms, i) => ({
      ...runWith("@e/pkg", "a.test.ts", "big test", ms),
      sha: `p${i}`,
    })),
  };
  // +500ms absolute, but only 1.05x the median — below the 1.5x floor.
  const current = runWith("@e/pkg", "a.test.ts", "big test", 10_500);
  expect(detectDrift(current, priorHistory)).toEqual([]);
});

test("detectDrift sorts multiple flags worst-ratio-first", () => {
  const priorHistory: History = {
    runs: Array.from({ length: 5 }, (_, i) => ({
      sha: `p${i}`,
      date: `d${i}`,
      packages: {
        "@e/pkg": {
          wallMs: 200,
          files: { "a.test.ts": 100, "b.test.ts": 100 },
          tests: [
            { file: "a.test.ts", name: "mild", durationMs: 100 },
            { file: "b.test.ts", name: "wild", durationMs: 100 },
          ],
        },
      },
    })),
  };
  const current: RunRecord = {
    sha: "current",
    date: "now",
    packages: {
      "@e/pkg": {
        wallMs: 1200,
        files: { "a.test.ts": 300, "b.test.ts": 900 },
        tests: [
          { file: "a.test.ts", name: "mild", durationMs: 300 }, // 3x
          { file: "b.test.ts", name: "wild", durationMs: 900 }, // 9x
        ],
      },
    },
  };
  const drift = detectDrift(current, priorHistory);
  expect(drift.map((d) => d.test)).toEqual(["wild", "mild"]);
});

test("slowestFiles picks the top N by wall time across all packages", () => {
  const run: RunRecord = {
    sha: "s",
    date: "d",
    packages: {
      "@e/a": { wallMs: 300, files: { "x.test.ts": 100, "y.test.ts": 200 }, tests: [] },
      "@e/b": { wallMs: 150, files: { "z.test.ts": 150 }, tests: [] },
    },
  };
  expect(slowestFiles(run, 2)).toEqual([
    { package: "@e/a", file: "y.test.ts", durationMs: 200 },
    { package: "@e/b", file: "z.test.ts", durationMs: 150 },
  ]);
});
