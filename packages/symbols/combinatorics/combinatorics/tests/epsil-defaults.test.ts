// What every Epsil family does, whatever its definitions: a rank outside the fiber is none (the
// definitions read one as garbage), and a compiled membership that isn't a boolean is no answer.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import {
  allFamilies,
  type EpsilFamily,
  epsilKernelOn,
  isEpsilFamily,
  kernelOn,
} from "../collections/src/families/index.ts";

const ce = bareEngine();
const families = allFamilies.filter(isEpsilFamily);

/** Params each in 0..4 and summing to at most 6. */
function sampleParams(count: number): number[][] {
  if (count === 0) return [[]];
  return sampleParams(count - 1).flatMap((p) =>
    [0, 1, 2, 3, 4].filter((x) => p.reduce((a, b) => a + b, x) <= 6).map((x) => [...p, x]),
  );
}

/** The first small params whose fiber has between 1 and 200 members, and one whose fiber is empty. */
function smallFibers(family: EpsilFamily): { some?: number[]; total?: bigint; empty?: number[] } {
  const kernel = epsilKernelOn(ce, family);
  const found: { some?: number[]; total?: bigint; empty?: number[] } = {};
  for (const p of sampleParams(family.paramCount)) {
    let total: unknown;
    try {
      total = kernel.count(p);
    } catch {
      continue;
    }
    if (typeof total !== "bigint") continue;
    if (total === 0n) found.empty ??= p;
    else if (total <= 200n && found.some === undefined) [found.some, found.total] = [p, total];
    if (found.some !== undefined && found.empty !== undefined) break;
  }
  return found;
}

test("every Epsil family refuses a rank outside its fiber", () => {
  let tested = 0;
  for (const family of families) {
    const at = (p: number[]): string => `${family.head}(${p.join(", ")})`;
    const { some, total, empty } = smallFibers(family);
    for (const kernel of [kernelOn(ce, family), epsilKernelOn(ce, family)]) {
      if (some !== undefined) {
        for (const r of [total!, total! + 1n, -1n])
          expect(() => kernel.unrank(some, r), `${at(some)} at ${r}`).toThrow(RangeError);
        expect(kernel.unrank(some, total! - 1n), `${at(some)} at the last rank`).toBeDefined();
      }
      if (empty !== undefined) expect(() => kernel.unrank(empty, 0n), `${at(empty)} at 0`).toThrow(RangeError);
    }
    if (some !== undefined || empty !== undefined) tested++;
  }
  // Every family has small params to look at; a new one that does not needs a reason here.
  expect(tested).toBe(families.length);
});

test("a compiled membership that isn't a boolean declines without interpreting", () => {
  // `valid` reads the table and answers a number: compiled, it is no boolean. Building the exact
  // table is what interpreting would cost, so the kernel computes only the doubles.
  const family: EpsilFamily = {
    head: "NotBooleanMembership",
    paramCount: 1,
    kind: "ints",
    params: ["_n"],
    epsil: {
      count: 1,
      unrank: ["List", 1],
      rank: 0,
      valid: ["Add", ["At", "_tables", 1], 1],
      tables: ["List", "_n", "_n"],
    },
  };
  const computed: string[] = [];
  const kernel = kernelOn(ce, family, {}, { onTables: (p, precision) => computed.push(`${precision}:${p.join(",")}`) });
  expect(() => kernel.valid([1], [3])).toThrow(RangeError);
  expect(computed).toEqual(["double:3"]);
});
