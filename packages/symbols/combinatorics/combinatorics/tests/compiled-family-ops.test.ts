// The kernel swallows what compiled code throws and answers from the interpreter, so a broken
// compiled op (a ReferenceError from a skipped preamble, say) would show only as slowness. This
// drives every Epsil family's compiled operations over small fibers and fails on any throw that
// isn't a RangeError decline.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { COMPILED_FAMILIES } from "../collections/src/families/compiled-families.generated.js";
import {
  allFamilies,
  type EpsilFamily,
  isCompiledBug,
  isEpsilFamily,
  kernelOn,
} from "../collections/src/families/index.ts";

type Generated = Record<string, unknown>;
const entries = COMPILED_FAMILIES as unknown as Record<string, Generated>;

/** Params each in 0..6 and summing to at most 6, smallest first. */
function sampleParams(count: number): number[][] {
  const all = (n: number): number[][] =>
    n === 0
      ? [[]]
      : all(n - 1).flatMap((p) =>
          [0, 1, 2, 3, 4, 5, 6].filter((x) => p.reduce((a, b) => a + b, x) <= 6).map((x) => [...p, x]),
        );
  const sum = (p: number[]) => p.reduce((a, b) => a + b, 0);
  return all(count).toSorted((a, b) => sum(a) - sum(b));
}

/** A member one entry away from itself. */
const nearMiss = (element: unknown): unknown =>
  Array.isArray(element)
    ? element.length > 0
      ? [nearMiss(element[0]), ...element.slice(1)]
      : [1]
    : Number(element) + 1;

const quietly = <T>(f: () => T): T | undefined => {
  try {
    return f();
  } catch {
    return undefined; // a decline; what compiled code threw is reported through onCompiledError
  }
};

const operationsOf = (head: string): string[] =>
  Object.entries(entries[head] ?? {})
    .filter(([, value]) => typeof value === "function")
    .map(([key]) => `${head}.${key}`);

test("compiled family operations raise no programming errors", () => {
  const ce = bareEngine();
  const problems = new Set<string>();
  const called = new Set<string>();
  // The generated code, noting each operation as it runs.
  const generated = Object.fromEntries(
    Object.entries(entries).map(([head, entry]) => [
      head,
      Object.fromEntries(
        Object.entries(entry).map(([key, value]) => [
          key,
          typeof value === "function"
            ? (...args: unknown[]) => {
                called.add(`${head}.${key}`);
                return (value as (...a: unknown[]) => unknown)(...args);
              }
            : value,
        ]),
      ),
    ]),
  ) as unknown as typeof COMPILED_FAMILIES;

  for (const family of allFamilies.filter(isEpsilFamily) as EpsilFamily[]) {
    const kernel = kernelOn(ce, family, generated, {
      fast: false, // the fast paths would answer first
      onCompiledError: (operation, error) => {
        if (isCompiledBug(error)) problems.add(`${family.head}.${operation}: ${String(error)}`);
      },
    });
    const ops = operationsOf(family.head);
    for (const p of sampleParams(family.paramCount)) {
      if (ops.every((op) => called.has(op))) break;
      const total = quietly(() => kernel.count(p));
      const unbounded = total === Number.POSITIVE_INFINITY;
      if (!unbounded && (typeof total !== "bigint" || total === 0n || total > 1_000n)) continue;
      for (const r of unbounded ? [0n, 1n, 5n] : new Set([0n, (total as bigint) / 2n, (total as bigint) - 1n])) {
        const element = quietly(() => kernel.unrank(p, r));
        if (element === undefined) continue;
        quietly(() => kernel.rank(element, p));
        quietly(() => kernel.valid(element, p));
        quietly(() => kernel.valid(nearMiss(element) as never, p));
      }
    }
  }

  expect([...problems]).toEqual([]);
  // Not vacuous: every compiled operation ran at least once.
  const never = Object.keys(entries)
    .flatMap(operationsOf)
    .filter((op) => !called.has(op));
  expect(never).toEqual([]);
});
