// VexillaryPermutations' count: Gessel's recurrence against the interpreted table, and where it stops.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { epsilKernelOn, kernelOn } from "../../collections/src/families/epsil.ts";
import { RECURRENCE_TOP, vexillaryExact } from "../../collections/src/families/exact-recurrences.ts";
import { vexillaryPermutations } from "../src/families/restrictions.ts";

const ce = bareEngine();
const epsil = epsilKernelOn(ce, vexillaryPermutations);
const fast = kernelOn(ce, vexillaryPermutations);

test("the count is the interpreted table's, n up to 14", () => {
  for (let n = 0; n <= 14; n++) expect([n, fast.count([n])]).toEqual([n, epsil.count([n])]);
});

// A005802, Av(1234): vexillary is Wilf-equivalent to it.
const A005802 = [
  1n,
  1n,
  2n,
  6n,
  23n,
  103n,
  513n,
  2761n,
  15767n,
  94359n,
  586590n,
  3763290n,
  24792705n,
  167078577n,
  1148208090n,
  8026793118n,
  56963722223n,
];

test("the count is A005802", () => {
  A005802.forEach((term, n) => expect([n, vexillaryExact(n)]).toEqual([n, term]));
});

test("past 2^53 the count is exact, and past its bound the count declines at once, building no table", () => {
  expect(fast.count([30])).toBe(vexillaryExact(30));
  expect(vexillaryExact(30)! > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
  expect(vexillaryExact(RECURRENCE_TOP)).toBeDefined();
  expect(vexillaryExact(RECURRENCE_TOP + 1)).toBeUndefined();
  expect(() => fast.count([RECURRENCE_TOP + 1])).toThrow(RangeError);
});
