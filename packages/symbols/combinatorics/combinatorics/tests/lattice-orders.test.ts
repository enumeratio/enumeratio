import { bareEngine } from "@enumeratio/engine/testing";
import { declareStructures } from "@enumeratio/structures";
import { describe, expect, it } from "vite-plus/test";
import { declareCombinatorics } from "../src/index.ts";

// Set partitions under refinement and permutations under the weak order: lattices, not total
// orders. Each is checked against a plain reading of the definition (the meet and join found
// by brute force as the greatest lower and least upper bound among all elements) and for the
// lattice laws. n = 4 in the standard run, n = 5 under DEEP_TESTS.
const N = process.env.DEEP_TESTS === "1" ? 5 : 4;
const ce = bareEngine();
declareStructures(ce);
declareCombinatorics(ce);
const evaluate = (json: unknown) => ce.box(json as never).evaluate().json;

type Blocks = number[][];
const SP = (blocks: Blocks) => ["SetPartition", ["List", ...blocks.map((b) => ["List", ...b])]];
const PERM = (word: number[]) => ["Permutation", ["List", ...word]];

function setPartitions(n: number): Blocks[] {
  const go = (k: number, blocks: Blocks): Blocks[] =>
    k > n
      ? [blocks.map((b) => [...b])]
      : [
          ...blocks.flatMap((_, i) =>
            go(
              k + 1,
              blocks.map((b, j) => (i === j ? [...b, k] : b)),
            ),
          ),
          ...go(k + 1, [...blocks, [k]]),
        ];
  return go(1, []);
}

function permutations(n: number): number[][] {
  const go = (rest: number[]): number[][] =>
    rest.length === 0 ? [[]] : rest.flatMap((x) => go(rest.filter((y) => y !== x)).map((p) => [x, ...p]));
  return go(Array.from({ length: n }, (_, i) => i + 1));
}

// The definitions, read directly.
const refinesBlocks = (p: Blocks, q: Blocks) => p.every((b) => q.some((c) => b.every((e) => c.includes(e))));
// Right weak order: p <= q when every inversion of p (values a < b, b first) is one of q's.
const valueInversions = (w: number[]) =>
  new Set(
    w.flatMap((b, i) =>
      w
        .slice(i + 1)
        .filter((a) => a < b)
        .map((a) => `${a}<${b}`),
    ),
  );
const weakLeq = (p: number[], q: number[]) => {
  const big = valueInversions(q);
  return [...valueInversions(p)].every((x) => big.has(x));
};

/** The element satisfying `ok` that is below (or above) all the others that do. */
function extreme<T>(all: T[], ok: (x: T) => boolean, leq: (a: T, b: T) => boolean, least: boolean): T {
  const candidates = all.filter(ok);
  const found = candidates.filter((c) => candidates.every((d) => (least ? leq(c, d) : leq(d, c))));
  expect(found).toHaveLength(1);
  return found[0]!;
}

const sign = (below: boolean, above: boolean) => (below && above ? 0 : below ? -1 : above ? 1 : "NaN");

function laws(name: string, all: unknown[][], wrap: (x: never) => unknown) {
  it(`${name}: idempotent, commutative, absorbing`, () => {
    for (const p of all) {
      const x = wrap(p as never);
      expect(evaluate(["Min", x, x])).toEqual(evaluate(x));
      expect(evaluate(["Max", x, x])).toEqual(evaluate(x));
      for (const q of all) {
        const y = wrap(q as never);
        expect(evaluate(["Min", x, y])).toEqual(evaluate(["Min", y, x]));
        expect(evaluate(["Max", x, y])).toEqual(evaluate(["Max", y, x]));
        expect(evaluate(["Min", x, ["Max", x, y]])).toEqual(evaluate(x));
        expect(evaluate(["Max", x, ["Min", x, y]])).toEqual(evaluate(x));
      }
    }
  });
}

describe(`set partitions of ${N} under refinement`, () => {
  const all = setPartitions(N);
  const canon = (b: Blocks) => evaluate(SP(b));

  it("compares, meets and joins like the definition", () => {
    for (const p of all)
      for (const q of all) {
        expect(evaluate(["Compare", SP(p), SP(q)])).toEqual(sign(refinesBlocks(p, q), refinesBlocks(q, p)));
        const meet = extreme(all, (x) => refinesBlocks(x, p) && refinesBlocks(x, q), refinesBlocks, false);
        const join = extreme(all, (x) => refinesBlocks(p, x) && refinesBlocks(q, x), refinesBlocks, true);
        expect(evaluate(["GreatestLowerBound", SP(p), SP(q)])).toEqual(canon(meet));
        expect(evaluate(["LeastUpperBound", SP(p), SP(q)])).toEqual(canon(join));
        expect(evaluate(["Min", SP(p), SP(q)])).toEqual(canon(meet));
        expect(evaluate(["Max", SP(p), SP(q)])).toEqual(canon(join));
      }
  });

  laws("set partitions", all, SP);

  it("gives the examples", () => {
    expect(evaluate(["Compare", SP([[1, 2], [3]]), SP([[1], [2, 3]])])).toEqual("NaN");
    expect(evaluate(["Compare", SP([[1], [2], [3]]), SP([[1, 2, 3]])])).toEqual(-1);
    expect(evaluate(["Min", SP([[1, 2], [3]]), SP([[1], [2, 3]])])).toEqual(SP([[1], [2], [3]]));
    expect(evaluate(["Max", SP([[1, 2], [3]]), SP([[1], [2, 3]])])).toEqual(SP([[1, 2, 3]]));
  });

  it("has no meet across ground sets", () => {
    const input = ["Min", SP([[1, 2]]), SP([[1], [2], [3]])];
    expect(evaluate(input)).toEqual(input);
  });
});

describe(`permutations of ${N} under the weak order`, () => {
  const all = permutations(N);
  const canon = (w: number[]) => evaluate(PERM(w));

  it("compares, meets and joins like the definition", () => {
    for (const p of all)
      for (const q of all) {
        expect(evaluate(["Compare", PERM(p), PERM(q)])).toEqual(sign(weakLeq(p, q), weakLeq(q, p)));
        const meet = extreme(all, (x) => weakLeq(x, p) && weakLeq(x, q), weakLeq, false);
        const join = extreme(all, (x) => weakLeq(p, x) && weakLeq(q, x), weakLeq, true);
        expect(evaluate(["GreatestLowerBound", PERM(p), PERM(q)])).toEqual(canon(meet));
        expect(evaluate(["LeastUpperBound", PERM(p), PERM(q)])).toEqual(canon(join));
        expect(evaluate(["Min", PERM(p), PERM(q)])).toEqual(canon(meet));
        expect(evaluate(["Max", PERM(p), PERM(q)])).toEqual(canon(join));
      }
  });

  laws("permutations", all, PERM);

  it("has no meet across lengths", () => {
    const input = ["Min", PERM([2, 1]), PERM([1, 2, 3])];
    expect(evaluate(input)).toEqual(input);
  });
});
