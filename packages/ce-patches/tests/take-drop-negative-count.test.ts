import { ComputeEngine, JavaScriptTarget } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, takeDropNegativeCount } from "../src/index.ts";

const ce = new ComputeEngine();
applyPatch(ce, takeDropNegativeCount);

const list = ["List", 1, 2, 3, 4, 5] as const;

// Take/Drop are lazy collections (`collection.isLazy`), so plain `.evaluate()` hands back
// the unevaluated call, not a materialized `List` -- `{ materialization: true }` is what
// `@enumeratio/evaluation`'s `runCases` (and the reference examples it checks) use for
// exactly this: "a lazy collection's `expected` is its elements, not the call."
const materialized = (expr: unknown): unknown => ce.box(expr as never).evaluate({ materialization: true }).json;

test("Take(l, -n) is the last n elements", () => {
  expect(materialized(["Take", list, -2])).toEqual(["List", 4, 5]);
});

test("Drop(l, -n) is all but the last n elements", () => {
  expect(materialized(["Drop", list, -2])).toEqual(["List", 1, 2, 3]);
});

test("a negative count past the source length declines (stays unevaluated), as Wolfram's Take::take/Drop::drop do", () => {
  // Not a clamp: Wolfram errors (`Take::take`) and leaves the call unevaluated rather than
  // answer with a clamped list -- `{ materialization: true }` still shows the call itself
  // when there is nothing to materialize into.
  expect(materialized(["Take", list, -10])).toEqual(["Take", list, -10]);
  expect(materialized(["Drop", list, -10])).toEqual(["Drop", list, -10]);
  const take = ce.box(["Take", list, -10]);
  expect(take.count).toBeUndefined();
  expect(take.at(1)).toBeUndefined();
  expect([...take.each()]).toEqual([]);
});

test("a positive count past the source length declines too, not native's clamp", () => {
  expect(materialized(["Take", list, 10])).toEqual(["Take", list, 10]);
  expect(materialized(["Drop", list, 10])).toEqual(["Drop", list, 10]);
  const drop = ce.box(["Drop", list, 10]);
  expect(drop.count).toBeUndefined();
  expect(drop.at(1)).toBeUndefined();
  expect([...drop.each()]).toEqual([]);
});

test("a count of exactly the source length still works, either sign", () => {
  expect(materialized(["Take", list, 5])).toEqual(["List", 1, 2, 3, 4, 5]);
  expect(materialized(["Take", list, -5])).toEqual(["List", 1, 2, 3, 4, 5]);
  expect(materialized(["Drop", list, 5])).toEqual(["List"]);
  expect(materialized(["Drop", list, -5])).toEqual(["List"]);
});

test("Take(l, -n) on a lazy source (Range) stays exact, not just the materialized List case", () => {
  expect(materialized(["Take", ["Range", 1, 10], -3])).toEqual(["List", 8, 9, 10]);
  expect(materialized(["Drop", ["Range", 1, 10], -3])).toEqual(["List", 1, 2, 3, 4, 5, 6, 7]);
});

test("a non-negative count is untouched", () => {
  expect(materialized(["Take", list, 2])).toEqual(["List", 1, 2]);
  expect(materialized(["Drop", list, 2])).toEqual(["List", 3, 4, 5]);
});

test("the collection protocol (not just top-level evaluate) reflects the correction", () => {
  const take = ce.box(["Take", list, -2]);
  expect(take.count).toBe(2);
  expect(take.at(1)?.toString()).toBe("4");
  expect([...take.each()].map((x) => x.toString())).toEqual(["4", "5"]);
});

test("a negative count compiled to JavaScript (a runtime, not constant, count) also reads from the end", () => {
  const fn = ce.box(["Function", ["Take", list, "n"], "n"]);
  const { success, code } = new JavaScriptTarget().compile(fn) as { success?: boolean; code?: string };
  expect(success).toBe(true);
  // oxlint-disable-next-line no-implied-eval -- running compute-engine-compiled source is the point
  const compiled = new Function(`"use strict"; return (${code});`)() as (n: number) => number[];
  expect(compiled(-2)).toEqual([4, 5]);
});

test("a compiled negative count past the source length throws -- a compiled function always returns a concrete value, so it has no unevaluated form to decline into", () => {
  const takeFn = ce.box(["Function", ["Take", list, "n"], "n"]);
  const dropFn = ce.box(["Function", ["Drop", list, "n"], "n"]);
  const compile = (fn: typeof takeFn): ((n: number) => number[]) => {
    const { code } = new JavaScriptTarget().compile(fn) as { code?: string };
    // oxlint-disable-next-line no-implied-eval -- running compute-engine-compiled source is the point
    return new Function(`"use strict"; return (${code});`)() as (n: number) => number[];
  };
  expect(() => compile(takeFn)(-10)).toThrow();
  expect(() => compile(dropFn)(-10)).toThrow();
  expect(() => compile(takeFn)(10)).toThrow();
  expect(() => compile(dropFn)(10)).toThrow();
  expect(compile(takeFn)(5)).toEqual([1, 2, 3, 4, 5]);
  expect(compile(dropFn)(5)).toEqual([]);
  // Not a clamp, and not thrown, for a count within range.
  expect(compile(takeFn)(-2)).toEqual([4, 5]);
});
