// The numeric sequences defined in Epsil (src/families/numeric-definitions.ts), held to closed forms
// written here in bigints: the kernel from the definitions alone and the one with its TS fast path
// agree with them on the first terms, on membership around them, and past 2^53, where a term is a
// bigint (as the TS kernels returned it) and only the interpreter answers.

import { bareEngine } from "@enumeratio/engine/testing";
import { evaluateEpsil } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { epsilKernelOn, isEpsilFamily, kernelOn, liftFamily } from "../src/families/epsil.ts";
import { entries as closedForm } from "../src/families/numeric-closed-form.ts";
import { definitions, UNWIRED } from "../src/families/numeric-definitions.ts";
import { entries as sets } from "../src/families/numeric-sets.ts";
import { needsBigint } from "../src/families/types.ts";

const ce = bareEngine();
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/** The term at position n = 1, 2, … of each sequence, exact. */
const TERM: Record<string, (n: bigint, p: number[]) => bigint> = {
  TriangularNumbers: (n) => (n * (n + 1n)) / 2n,
  PentagonalNumbers: (n) => (n * (3n * n - 1n)) / 2n,
  HexagonalNumbers: (n) => n * (2n * n - 1n),
  HeptagonalNumbers: (n) => (n * (5n * n - 3n)) / 2n,
  OctagonalNumbers: (n) => n * (3n * n - 2n),
  CenteredTriangularNumbers: (n) => (3n * n * n - 3n * n + 2n) / 2n,
  CenteredSquareNumbers: (n) => 2n * n * n - 2n * n + 1n,
  CenteredHexagonalNumbers: (n) => 3n * n * n - 3n * n + 1n,
  StarNumbers: (n) => 6n * n * n - 6n * n + 1n,
  PronicNumbers: (n) => n * (n + 1n),
  SquareNumbers: (n) => n * n,
  PolygonalNumbers: (n, [k]) => (BigInt(k - 2) * n * n - BigInt(k - 4) * n) / 2n,
  CubeNumbers: (n) => n ** 3n,
  TetrahedralNumbers: (n) => (n * (n + 1n) * (n + 2n)) / 6n,
  PentatopeNumbers: (n) => (n * (n + 1n) * (n + 2n) * (n + 3n)) / 24n,
  SquarePyramidalNumbers: (n) => (n * (n + 1n) * (2n * n + 1n)) / 6n,
  PowersOfTwo: (n) => 2n ** (n - 1n),
  AllOnes: () => 1n,
};

const PARAMS: Record<string, number[][]> = {
  PolygonalNumbers: [[3], [4], [5], [6], [7], [8], [9], [12], [100]],
};
const paramsOf = (head: string): number[][] => PARAMS[head] ?? [[]];

/** How far along each sequence the exhaustive checks go: all of them are a few terms' worth of work. */
const TERMS = (head: string): number => (head === "PowersOfTwo" ? 60 : head === "AllOnes" ? 20 : 1200);

/** A term as the kernels return it: a number where it is exact in one, else the bigint. */
const asTerm = (x: bigint): number | bigint => (x <= MAX_SAFE ? Number(x) : x);

const entry = (head: string) => liftFamily([...closedForm, ...sets].find((f) => f.head === head)!);
const definition = (head: string) => definitions.get(head)!;
const epsil = (head: string) => epsilKernelOn(ce, definition(head));
const full = (head: string) => kernelOn(ce, entry(head));

test("the numeric sequences are Epsil definitions with their TS kernels as fast paths, bar the unwired ones", () => {
  expect(definitions.size).toBeGreaterThan(10);
  for (const head of definitions.keys()) {
    const family = entry(head);
    expect(isEpsilFamily(family), head).toBe(true);
    expect(kernelOn(ce, family).fast, head).toBe(UNWIRED.has(head) ? undefined : true);
    expect(epsil(head).fast, head).toBeUndefined();
  }
});

for (const head of definitions.keys()) {
  for (const p of paramsOf(head)) {
    const where = `${head}(${p.join(", ")})`;
    const term = (n: number | bigint) => TERM[head](BigInt(n), p);
    const kernels = [
      ["Epsil", epsil(head)],
      ["fast", full(head)],
    ] as const;

    test(`${where}: the first terms, their places and the numbers between`, () => {
      const first = TERMS(head);
      const members = new Map<bigint, number>();
      for (let r = 0; r < first; r++) if (!members.has(term(r + 1))) members.set(term(r + 1), r);
      // Every integer up to the last of the first dozens of terms, and the neighbours of the rest.
      const probes = new Set<bigint>();
      for (let x = -2n; x <= term(Math.min(first, 40)) && x < 5000n; x++) probes.add(x);
      for (const x of members.keys()) for (const d of [-1n, 0n, 1n]) probes.add(x + d);
      for (const [name, kernel] of kernels) {
        expect([name, kernel.count(p)]).toEqual([name, Infinity]);
        for (let r = 0; r < first; r++) {
          expect([name, r, kernel.unrank(p, BigInt(r))]).toEqual([name, r, asTerm(term(r + 1))]);
        }
        for (const x of probes) {
          const known = members.get(x);
          const element = asTerm(x);
          expect([name, x, kernel.valid(element, p)]).toEqual([name, x, known !== undefined]);
          expect([name, x, kernel.rank(element, p)]).toEqual([name, x, BigInt(known ?? -1)]);
        }
      }
    });

    // The first rank whose term a double can't hold; the interpreter answers from there.
    const crossing = ((): number => {
      if (head === "AllOnes") return 0;
      let [lo, hi] = [0, 1];
      while (term(hi + 1) <= MAX_SAFE) hi *= 2;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (term(mid + 1) <= MAX_SAFE) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    })();

    test(`${where}: terms on either side of 2^53 are exact`, () => {
      if (head === "AllOnes") return;
      for (const [name, kernel] of kernels) {
        for (let r = Math.max(0, crossing - 6); r < crossing + 6; r++) {
          const x = term(r + 1);
          expect([name, r, kernel.unrank(p, BigInt(r))]).toEqual([name, r, asTerm(x)]);
          for (const y of [x - 1n, x, x + 1n]) {
            expect([name, y, kernel.valid(asTerm(y), p)]).toEqual([name, y, y === x]);
            if (y === x) expect([name, y, kernel.rank(asTerm(y), p)]).toEqual([name, y, BigInt(r)]);
          }
        }
      }
    });

    test(`${where}: far out, terms are exact bigints, and a rank no double holds is answered`, () => {
      const ranks = head === "PowersOfTwo" ? [100n, 1000n, 3000n] : [10n ** 6n, 10n ** 12n, 10n ** 15n, 10n ** 20n];
      for (const [name, kernel] of kernels) {
        for (const r of ranks) {
          const x = term(r + 1n);
          if (head === "AllOnes") expect([name, kernel.unrank(p, r)]).toEqual([name, 1]);
          else {
            expect([name, r, kernel.unrank(p, r)]).toEqual([name, r, asTerm(x)]);
            expect([name, r, kernel.valid(asTerm(x), p)]).toEqual([name, r, true]);
            expect([name, r, kernel.valid(asTerm(x + 1n), p)]).toEqual([name, r, false]);
            expect([name, r, kernel.rank(asTerm(x), p)]).toEqual([name, r, r]);
          }
        }
      }
    });

    // A member is never denied, however large: the answer is exact or declined, never false or -1.
    // (A power of two's rank is its exponent, so its sizes are the exponents.)
    test(`${where}: members and non-members at ranks ~1e30 and ~1e60 are never misjudged`, () => {
      if (head === "AllOnes") return;
      const ranks = head === "PowersOfTwo" ? [10n ** 3n, 3n * 10n ** 3n] : [10n ** 30n, 10n ** 60n];
      const answer = <T>(read: () => T): T | "declined" => {
        try {
          return read();
        } catch (error) {
          if (needsBigint(error)) return "declined";
          throw error;
        }
      };
      const kernel = epsil(head);
      let answered = 0;
      for (const r of ranks) {
        const x = term(r + 1n);
        const [member, below, above] = [x, x - 1n, x + 1n].map((y) => answer(() => kernel.valid(y as never, p)));
        const place = answer(() => kernel.rank(x as never, p));
        // Never denied; every size here is answered, so an exact `true` and the rank back is held to.
        expect([r, member]).toEqual([r, true]);
        expect([r, place]).toEqual([r, r]);
        expect([r, below, above]).toEqual([r, false, false]);
        answered++;
      }
      expect(answered).toBe(ranks.length);
    });
  }
}

test("a negative rank is outside the fiber", () => {
  expect(() => epsil("TriangularNumbers").unrank([], -1n)).toThrow(RangeError);
  expect(() => full("TriangularNumbers").unrank([], -1n)).toThrow(RangeError);
});

test("a term too large for the interpreter to expand is declined, not an error", () => {
  // The fast path expands a power of two as far as a bigint goes; the interpreter far less.
  const declined = (read: () => unknown): boolean => {
    try {
      read();
      return false;
    } catch (error) {
      return error instanceof RangeError && needsBigint(error);
    }
  };
  expect(declined(() => epsil("PowersOfTwo").unrank([], 10n ** 9n))).toBe(true);
  expect(declined(() => full("PowersOfTwo").unrank([], 2n ** 31n))).toBe(true);
  expect(full("PowersOfTwo").unrank([], 2000000n)).toBe(2n ** 2000000n);
});

test("PolygonalNumbers below 3 sides has no terms", () => {
  for (const k of [0, 1, 2]) {
    expect(epsil("PolygonalNumbers").count([k])).toBe(0n);
    expect(full("PolygonalNumbers").count([k])).toBe(0n);
    // And no number is a member of it, in either kernel.
    for (const kernel of [epsil("PolygonalNumbers"), full("PolygonalNumbers")])
      for (const x of [1, 2, 3, 4, 6, 10]) {
        expect([k, x, kernel.valid(x, [k])]).toEqual([k, x, false]);
        expect([k, x, kernel.rank(x, [k])]).toEqual([k, x, -1n]);
      }
  }
});

test("a number that is not an integer, or not a number, is no member", () => {
  for (const [name, kernel] of [
    ["Epsil", epsil("TriangularNumbers")],
    ["fast", full("TriangularNumbers")],
  ] as const) {
    for (const x of [1.5, Number.NaN, Number.POSITIVE_INFINITY, [1], 0, -3])
      expect([name, x, kernel.valid(x as never, [])]).toEqual([name, x, false]);
  }
});

// The definitions as the interpreter reads them, bypassing compiled code and the fast paths.
test("the interpreted definitions give the same terms and places", () => {
  for (const head of definitions.keys()) {
    const family = definition(head);
    for (const p of paramsOf(head).slice(0, 3)) {
      const bind = Object.fromEntries(family.params.map((name, i) => [name, p[i]]));
      const term = (n: number) => TERM[head](BigInt(n), p);
      for (let r = 0; r < 8; r++) {
        expect([head, r, evaluateEpsil(ce, family.epsil.unrank, { ...bind, _r: r })]).toEqual([
          head,
          r,
          Number(term(r + 1)),
        ]);
        if (head !== "AllOnes" || r === 0)
          expect([head, r, evaluateEpsil(ce, family.epsil.rank, { ...bind, _x: Number(term(r + 1)) })]).toEqual([
            head,
            r,
            r,
          ]);
      }
      const terms = new Set(Array.from({ length: 12 }, (_, r) => Number(term(r + 1))));
      for (let x = 0; x < 60; x++)
        expect([head, x, evaluateEpsil(ce, family.epsil.valid, { ...bind, _x: x })]).toEqual([
          head,
          x,
          terms.has(x) ? "True" : "False",
        ]);
    }
  }
});
