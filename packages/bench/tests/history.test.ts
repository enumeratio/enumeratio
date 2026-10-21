import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { buildIndex, detectDrift } from "../src/history.ts";
import type { CaseResult, Report } from "../src/types.ts";

const report = (results: CaseResult[], fingerprint?: string): Report =>
  ({ results, ...(fingerprint === undefined ? {} : { machine: { fingerprint } }) }) as unknown as Report;
const ok = (name: string, median: number): CaseResult => ({ name, status: "ok", median });

test("drift needs both the ratio and the floor, over enough prior runs", () => {
  const prior = Array.from({ length: 5 }, () =>
    report([ok("A/slow", 10e6), ok("A/tiny", 0.1e6), ok("A/steady", 10e6)]),
  );
  const current = report([ok("A/slow", 20e6), ok("A/tiny", 0.5e6), ok("A/steady", 11e6)]);
  expect(detectDrift(current, prior).map((d) => d.name)).toEqual(["A/slow"]);
  expect(detectDrift(current, prior.slice(1))).toEqual([]);
});

const CASES = ["A/one", "A/two", "A/three", "A/four", "A/five", "A/six"];
const all = (ms: number, overrides: Record<string, number> = {}, fp?: string): Report =>
  report(
    CASES.map((c) => ok(c, (overrides[c] ?? ms) * 1e6)),
    fp,
  );

test("a bimodal runner is judged against its own history, not flagged for its slow mode", () => {
  const prior = Array.from({ length: 8 }, (_, i) => all(i % 2 === 0 ? 10 : 25, {}, "gamma"));
  expect(detectDrift(all(25, {}, "gamma"), prior)).toEqual([]);
});

test("a real step on one case on the same runner is flagged, undiluted by the other cases", () => {
  const prior = Array.from({ length: 6 }, () => all(10, {}, "gamma"));
  const drift = detectDrift(all(10, { "A/two": 30 }, "gamma"), prior);
  expect(drift.map((d) => [d.name, d.basis])).toEqual([["A/two", "same-runner"]]);
});

test("a run that is uniformly slower is the runner, not a regression", () => {
  const prior = Array.from({ length: 6 }, () => all(10, {}, "gamma"));
  expect(detectDrift(all(20, {}, "gamma"), prior)).toEqual([]);
  // but a case well past the uniform slowdown still shows
  const drift = detectDrift(all(20, { "A/six": 60 }, "gamma"), prior);
  expect(drift.map((d) => d.name)).toEqual(["A/six"]);
  expect(drift[0]?.runnerFactor).toBe(2);
});

test("with too few runs on this fingerprint, every runner is the baseline, normalized by the run's slowdown", () => {
  const other = Array.from({ length: 6 }, () => all(10, {}, "other"));
  const prior = [...other, all(10, {}, "gamma"), all(10, {}, "gamma")];
  expect(detectDrift(all(15, {}, "gamma"), prior)).toEqual([]);
  const drift = detectDrift(all(15, { "A/one": 45 }, "gamma"), prior);
  expect(drift.map((d) => [d.name, d.basis])).toEqual([["A/one", "cross-runner"]]);
});

test("the index is rebuilt from each run's run.json, oldest first", () => {
  const dir = mkdtempSync(join(tmpdir(), "bench-data-"));
  for (const [id, date] of [
    ["b", "2026-09-27T05:10:00Z"],
    ["a", "2026-09-26T05:10:00Z"],
  ]) {
    mkdirSync(join(dir, "runs", id as string), { recursive: true });
    writeFileSync(join(dir, "runs", id as string, "run.json"), JSON.stringify({ id, date }));
  }
  mkdirSync(join(dir, "runs", "partial"));
  expect(buildIndex(dir).runs.map((r) => r.id)).toEqual(["a", "b"]);
});
