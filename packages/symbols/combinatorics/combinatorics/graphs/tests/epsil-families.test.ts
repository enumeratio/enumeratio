// The graph-area families defined in Epsil (BL-30), each against its TS kernel: the same count,
// the same element at every rank, rank inverting unrank, and the same membership over members
// and near misses. Epsil alone (`epsilKernelOn`), compiled and interpreted, and past 2^53 where
// the interpreter's exact integers take over.

import { ComputeEngine } from "@enumeratio/engine/unstable"; // unstable: a kernel test builds its own engine
import { evaluateEpsil } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { epsilKernelOn, type EpsilFamily, evaluateTables } from "../../collections/src/families/epsil.ts";
import {
  IsLabeledGraphByEdgesOf,
  IsLabeledGraphOf,
  IsTournamentOf,
  LabeledGraphByEdgesCount,
  LabeledGraphByEdgesRank,
  LabeledGraphByEdgesUnrank,
  LabeledGraphCount,
  LabeledGraphRank,
  LabeledGraphUnrank,
  TournamentCount,
  TournamentRank,
  TournamentUnrank,
} from "../src/families/core.ts";
import { labeledGraphs, labeledGraphsByEdges, tournaments } from "../src/families/epsil.ts";

const ce = new ComputeEngine();
// Larger parameter points and the past-2^53 round trips run nightly.
const DEEP = process.env.DEEP_TESTS === "1";

type Edges = number[][];
interface Reading {
  readonly family: EpsilFamily;
  readonly params: readonly number[][];
  readonly count: (p: number[]) => number;
  readonly unrank: (p: number[], r: number) => Edges;
  readonly rank: (x: Edges, p: number[]) => number;
  readonly valid: (x: Edges, p: number[]) => boolean;
}

const READINGS: Reading[] = [
  {
    family: tournaments,
    params: [[0], [1], [2], [3], [4], ...(DEEP ? [[5], [6]] : [])],
    count: ([n]) => TournamentCount(n),
    unrank: ([n], r) => TournamentUnrank(n, r),
    rank: (x, [n]) => TournamentRank(x, n),
    valid: (x, [n]) => IsTournamentOf(x, n),
  },
  {
    family: labeledGraphs,
    params: [[0], [1], [2], [3], [4], ...(DEEP ? [[5], [6]] : [])],
    count: ([n]) => LabeledGraphCount(n),
    unrank: ([n], r) => LabeledGraphUnrank(n, r),
    rank: (x, [n]) => LabeledGraphRank(x, n),
    valid: (x, [n]) => IsLabeledGraphOf(x, n),
  },
  {
    family: labeledGraphsByEdges,
    // m past C(n, 2) is the empty fiber.
    params: [[0, 0], [1, 0], [2, 1], [3, 0], [3, 2], [3, 4], [4, 3], [4, 6], [5, 4], [5, 9], ...(DEEP ? [[6, 7]] : [])],
    count: ([n, m]) => LabeledGraphByEdgesCount(n, m),
    unrank: ([n, m], r) => LabeledGraphByEdgesUnrank(n, m, r),
    rank: (x, [n]) => LabeledGraphByEdgesRank(x, n),
    valid: (x, [n, m]) => IsLabeledGraphByEdgesOf(x, n, m),
  },
];

/** Edge lists one step from a member: a pair reversed, bent into a loop, pushed out of range or
 *  into a repeat; an entry cut or added; two entries swapped. */
const nearMisses = (member: Edges, n: number): Edges[] => [
  ...member.flatMap((_, i) => [
    member.map((pair, j) => (i === j ? [pair[1], pair[0]] : pair)),
    member.map((pair, j) => (i === j ? [pair[0], pair[0]] : pair)),
    member.map((pair, j) => (i === j ? [pair[0], n + 1] : pair)),
    member.map((pair, j) => (i === j ? [0, pair[1]] : pair)),
    member.map((pair, j) => (i === j ? member[(i + 1) % member.length] : pair)),
    member.map((pair, j) => (i === j ? [...pair, 1] : pair)),
    member.map((pair, j) => (i === j ? [pair[0]] : pair)),
  ]),
  ...(member.length > 1 ? [member.toReversed()] : []),
  member.slice(1),
  [...member, [1, 2]],
];

for (const reading of READINGS) {
  const { family } = reading;
  const kernel = epsilKernelOn(ce, family);
  for (const p of reading.params) {
    test(`${family.head}(${p.join(", ")}) agrees with its TS kernel`, () => {
      const total = reading.count(p);
      expect(kernel.count(p)).toBe(BigInt(total));
      for (let r = 0; r < total; r++) {
        const element = kernel.unrank(p, BigInt(r)) as Edges;
        expect(element).toEqual(reading.unrank(p, r));
        expect(kernel.rank(element, p)).toBe(BigInt(r));
        expect(kernel.valid(element, p)).toBe(true);
        for (const candidate of nearMisses(element, p[0])) {
          const valid = reading.valid(candidate, p);
          expect([candidate, kernel.valid(candidate, p)]).toEqual([candidate, valid]);
          // A member in another order or orientation ranks as the TS kernel ranks it.
          if (valid) expect(kernel.rank(candidate, p)).toBe(BigInt(reading.rank(candidate, p)));
        }
      }
    });
  }
}

/** The definitions as the interpreter reads them, bypassing compiled code. */
const interpreted = (family: EpsilFamily, operation: keyof EpsilFamily["epsil"], bindings: Record<string, unknown>) => {
  const { tables } = family.epsil;
  const tabled = tables === undefined ? bindings : { ...bindings, _tables: evaluateTables(ce, tables, bindings) };
  return evaluateEpsil(ce, family.epsil[operation], tabled);
};

const list = (xs: unknown[]): unknown => ["List", ...xs.map((x) => (Array.isArray(x) ? list(x) : x))];

test("the interpreter agrees with the TS kernels", () => {
  for (const reading of READINGS) {
    const { family } = reading;
    const p = reading.params.at(-2)!;
    const bind = Object.fromEntries(family.params.map((name, i) => [name, p[i]]));
    const total = reading.count(p);
    expect(interpreted(family, "count", bind)).toBe(total);
    for (const r of [0, Math.floor(total / 2), total - 1]) {
      const element = reading.unrank(p, r);
      expect(interpreted(family, "unrank", { ...bind, _r: r })).toEqual(list(element));
      expect(interpreted(family, "rank", { ...bind, _x: list(element) })).toBe(r);
      expect(interpreted(family, "valid", { ...bind, _x: list(element) })).toBe("True");
    }
  }
});

/** Exact integers: past 2^53 the interpreter answers; rank inverts unrank across the fiber. */
function roundTrips(family: EpsilFamily, p: number[], total: bigint): void {
  const kernel = epsilKernelOn(ce, family);
  expect(kernel.count(p)).toBe(total);
  expect(total).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
  for (const r of [0n, 1n, total / 3n, total / 2n, total - 2n, total - 1n]) {
    const element = kernel.unrank(p, r);
    expect(kernel.valid(element, p)).toBe(true);
    expect(kernel.rank(element, p)).toBe(r);
  }
}

test.skipIf(!DEEP)("past 2^53 Tournaments and LabeledGraphs answer in exact integers", () => {
  const n = 12; // 2^66
  roundTrips(tournaments, [n], 2n ** 66n);
  roundTrips(labeledGraphs, [n], 2n ** 66n);
});

test.skipIf(!DEEP)("past 2^53 LabeledGraphsByEdges answers in exact integers", () => {
  let total = 1n; // C(66, 33)
  for (let i = 1n; i <= 33n; i++) total = (total * (66n - i + 1n)) / i;
  roundTrips(labeledGraphsByEdges, [12, 33], total);
});
