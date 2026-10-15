import { expect, test } from "vite-plus/test";
import { failAll, MAX_BISECT_RUNS, type Result, runIn } from "../src/run.ts";

// A kernel killed by the memory watchdog before it prints anything loses its whole batch.
// runIn re-runs such a batch in halves, so only the poison item's chunk errors. The kernel is
// faked: a batch containing a poison source fails whole, any other answers item by item.
const POISON = "poison";

function fake(poison: ReadonlySet<string>) {
  const calls: number[] = [];
  const batchRunner = async (sources: readonly string[]): Promise<Result[]> => {
    calls.push(sources.length);
    if (sources.some((s) => poison.has(s))) {
      return failAll(sources.length, "wolframscript: killed (memory, peak 4112 MB)");
    }
    return sources.map((s) => ({ value: `v:${s}` }));
  };
  return { calls, batchRunner };
}

const items = (n: number, at: Record<number, string> = {}) => Array.from({ length: n }, (_, i) => at[i] ?? `s${i}`);

const erroredAt = (results: Result[]) => results.flatMap((r, i) => ("error" in r ? [i] : []));

test("one poison item errors alone; the rest of its batch answers", async () => {
  const { batchRunner } = fake(new Set([POISON]));
  const results = await runIn("wolfram", items(40, { 17: POISON }), { batchRunner });
  expect(results).toHaveLength(40);
  expect(erroredAt(results)).toEqual([17]);
  expect(results[18]).toEqual({ value: "v:s18" });
});

test("two poison items error; bisecting stays under the run cap", async () => {
  const { calls, batchRunner } = fake(new Set([POISON]));
  const results = await runIn("wolfram", items(40, { 3: POISON, 35: POISON }), { batchRunner });
  expect(erroredAt(results)).toEqual([3, 35]);
  expect(calls.length - 1).toBeLessThanOrEqual(MAX_BISECT_RUNS);
});

test("past the retry cap the unresolved chunks error as a whole, and the run finishes", async () => {
  const sources = items(40);
  const { calls, batchRunner } = fake(new Set(sources));
  const results = await runIn("wolfram", sources, { batchRunner });
  expect(results).toHaveLength(40);
  expect(erroredAt(results)).toHaveLength(40);
  expect(calls.length - 1).toBeLessThanOrEqual(MAX_BISECT_RUNS);
});

test("a failure that is not a watchdog kill is not bisected", async () => {
  const calls: number[] = [];
  const batchRunner = async (sources: readonly string[]): Promise<Result[]> => {
    calls.push(sources.length);
    return failAll(sources.length, "wolframscript: exit 1: license");
  };
  const results = await runIn("wolfram", items(40), { batchRunner });
  expect(calls).toEqual([40]);
  expect(erroredAt(results)).toHaveLength(40);
});

test("a head half failing wholly for the parent's reason is systemic: the tail is not run", async () => {
  const sources = items(40);
  const { calls, batchRunner } = fake(new Set(sources));
  const results = await runIn("wolfram", sources, { batchRunner });
  expect(erroredAt(results)).toHaveLength(40);
  // The batch, then head halves down to a pair, whose two leaves both run; no tail above that.
  expect(calls).toEqual([40, 20, 10, 5, 3, 2, 1, 1]);
});

test("a head that died partway skips the tail, which runIn would discard", async () => {
  const calls: number[] = [];
  const batchRunner = async (chunk: readonly string[]): Promise<Result[]> => {
    calls.push(chunk.length);
    if (chunk.length === 8) return failAll(8, "wolframscript: killed (memory, peak 4112 MB)");
    return chunk.map((_, i) => (i < 2 ? { value: "ok" } : { error: "no output" }));
  };
  const results = await runIn("wolfram", items(8), { batchRunner });
  // The batch (lost), its head of 4 (partial), no tail; then runIn resumes after item 2.
  expect(calls.slice(0, 2)).toEqual([8, 4]);
  expect(results).toHaveLength(8);
});

test("a healthy batch costs one run", async () => {
  const { calls, batchRunner } = fake(new Set());
  await runIn("wolfram", items(40), { batchRunner });
  expect(calls).toEqual([40]);
});
