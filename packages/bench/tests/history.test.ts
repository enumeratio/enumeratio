import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { buildIndex, detectDrift } from "../src/history.ts";
import type { CaseResult, Report } from "../src/types.ts";

const report = (results: CaseResult[]): Report => ({ results }) as unknown as Report;
const ok = (name: string, median: number): CaseResult => ({ name, status: "ok", median });

test("drift needs both the ratio and the floor, over enough prior runs", () => {
  const prior = Array.from({ length: 5 }, () =>
    report([ok("A/slow", 10e6), ok("A/tiny", 0.1e6), ok("A/steady", 10e6)]),
  );
  const current = report([ok("A/slow", 20e6), ok("A/tiny", 0.5e6), ok("A/steady", 11e6)]);
  expect(detectDrift(current, prior).map((d) => d.name)).toEqual(["A/slow"]);
  expect(detectDrift(current, prior.slice(1))).toEqual([]);
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
