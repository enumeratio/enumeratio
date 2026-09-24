import { expect, test } from "vite-plus/test";
import { evaluateIsolated } from "../src/node.ts";

test("evaluateIsolated returns a normal value", async () => {
  const result = await evaluateIsolated(["Add", 2, 3]);
  expect(result).toBe(5);
});

test("evaluateIsolated kills a computation that outruns timeMs", async () => {
  const slow = ["Sum", ["Mod", "k", 97], ["Tuple", "k", 1, 2_000_000_000]];
  const result = await evaluateIsolated(slow, { timeMs: 50 });
  expect(result).toBe("Aborted");
});

test("evaluateIsolated aborts a computation that outgrows memoryBytes", async () => {
  // A deeply nested unevaluated Plus builds a large expression tree with no arithmetic
  // shortcut to collapse it — cheap to describe, expensive to hold boxed in memory.
  const wide: unknown[] = ["List"];
  for (let i = 0; i < 2_000_000; i++) wide.push(["Hold", i]);
  const result = await evaluateIsolated(wide, { memoryBytes: 8 * 1024 * 1024, timeMs: 10_000 });
  expect(result).toBe("Aborted");
});
