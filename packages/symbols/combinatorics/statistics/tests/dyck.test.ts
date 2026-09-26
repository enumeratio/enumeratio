import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyDefinition } from "../src/declare.ts";
import { DYCK_STATISTICS } from "../src/dyck.ts";
import { bySignature } from "../src/types.ts";

const ce = new ComputeEngine();
const index = bySignature(DYCK_STATISTICS);

/** Every Dyck word of semilength n, as 1 = up and 0 = down. */
function dyckWords(n: number): number[][] {
  const out: number[][] = [];
  const walk = (word: number[], up: number, down: number): void => {
    if (word.length === 2 * n) {
      out.push([...word]);
      return;
    }
    if (up < n) walk([...word, 1], up + 1, down);
    if (down < up) walk([...word, 0], up, down + 1);
  };
  walk([], 0, 0);
  return out;
}
const ALL = [0, 1, 2, 3, 4, 5].flatMap(dyckWords);

const evaluate = (head: string, w: number[]): number =>
  applyDefinition(ce, index.get(`${head}@DyckPath`)!, ce.box(["List", ...w])).re;

/** Heights after each step — the independent reading of the profile. */
const heights = (w: number[]): number[] => {
  let h = 0;
  return w.map((s) => (h += s === 1 ? 1 : -1));
};
const consecutive = (w: number[], a: number, b: number): number =>
  w.slice(0, -1).filter((s, k) => s === a && w[k + 1] === b).length;

/** The longest run of `value`, read with a plain loop. */
function longestRunOf(w: number[], value: number): number {
  let best = 0;
  let current = 0;
  for (const step of w) {
    current = step === value ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

/** a_1 .. a_n: the height right before each up step — the area sequence, against the diagonal. */
function areaSequence(w: number[]): number[] {
  let h = 0;
  const a: number[] = [];
  for (const s of w) {
    if (s === 1) {
      a.push(h);
      h += 1;
    } else h -= 1;
  }
  return a;
}
const dinvOf = (a: number[]): number => {
  let c = 0;
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++) {
      if (a[i] === a[j]) c++;
      if (a[i] === a[j]! + 1) c++;
    }
  return c;
};
/** H(0) .. H(n-1): the NE column ceiling read off the down steps, mountain height plus x. */
function columnCeilings(w: number[]): number[] {
  let h = 0;
  const hs: number[] = [];
  for (const s of w) {
    if (s === 0) {
      hs.push(h);
      h -= 1;
    } else h += 1;
  }
  return hs.map((height, x) => height + x);
}
/** The bounce statistic, walked directly off the column ceilings — independent of dyck.ts. */
function bounceOf(w: number[]): number {
  const n = w.length / 2;
  const h = columnCeilings(w);
  let k = 0;
  let blockIndex = 0;
  let total = 0;
  for (let tick = 0; tick < n; tick++) {
    if (k === n) continue;
    const newK = h[k]!;
    total += blockIndex * (newK - k);
    k = newK;
    blockIndex += 1;
  }
  return total;
}

const EXPECTED: Record<string, (w: number[]) => number> = {
  Height: (w) => (w.length === 0 ? 0 : Math.max(...heights(w))),
  Peaks: (w) => consecutive(w, 1, 0),
  Valleys: (w) => consecutive(w, 0, 1),
  DoubleRises: (w) => consecutive(w, 1, 1),
  Returns: (w) => heights(w).filter((h) => h === 0).length,
  TouchPointCount: (w) => heights(w).filter((h) => h === 0).length,
  InteriorReturns: (w) => heights(w).filter((h, k) => h === 0 && k + 1 < w.length).length,
  Hills: (w) => {
    const h = heights(w);
    return w.slice(0, -1).filter((s, k) => s === 1 && w[k + 1] === 0 && h[k] === 1).length;
  },
  InitialRise: (w) => {
    let k = 0;
    while (k < w.length && w[k] === 1) k++;
    return k;
  },
  MajorIndex: (w) => w.slice(0, -1).reduce((a, s, k) => (s === 1 && w[k + 1] === 0 ? a + k + 1 : a), 0),
  Area: (w) => heights(w).reduce((a, b) => a + b, 0),
  LongestAscent: (w) => longestRunOf(w, 1),
  LongestDescent: (w) => longestRunOf(w, 0),
  Coarea: (w) => {
    const n = w.length / 2;
    return (n * (n + 1)) / 2 - heights(w).reduce((a, b) => a + b, 0);
  },
  Dinv: (w) => dinvOf(areaSequence(w)),
  Bounce: (w) => bounceOf(w),
};

test("every Dyck definition has an independent reading", () => {
  for (const definition of DYCK_STATISTICS) expect(EXPECTED[definition.head], definition.head).toBeDefined();
});

for (const definition of DYCK_STATISTICS) {
  test(`${definition.head} agrees over every Dyck path of semilength 0..5`, () => {
    const expected = EXPECTED[definition.head]!;
    for (const w of ALL) expect(evaluate(definition.head, w), `[${w}]`).toBe(expected(w));
  });
}

// The q,t-Catalan invariant (Haglund): (area, dinv) and (bounce, area) are equidistributed
// over Dyck paths of a given semilength — both give the SAME bivariate polynomial
// sum q^x t^y, symmetric in q and t. This is the standard cross-check for a bounce/dinv
// implementation, independent of either being individually "obviously right": a
// transposition-style bug in one alone would still show up here as an asymmetric or
// mismatched polynomial.
function bivariatePolynomial(words: number[][], xOf: (w: number[]) => number, yOf: (w: number[]) => number) {
  const counts = new Map<string, number>();
  for (const w of words) {
    const key = `${xOf(w)},${yOf(w)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
const sortedEntries = (m: Map<string, number>) => [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1));

test("(Area, Dinv) and (Bounce, Area) share the same bivariate distribution for semilength 0..6", () => {
  // The "area" the (area, dinv)/(bounce, area) theorem is about is the DIAGONAL reading —
  // the sum of the area sequence — not this package's `Area` head, which sums the height
  // profile against the AXIS (see `Area`'s own definition in dyck.ts). They agree on nothing
  // in general; reusing `EXPECTED.Area` here would silently check the wrong invariant.
  const diagonalAreaOf = (w: number[]) => areaSequence(w).reduce((a, b) => a + b, 0);
  for (let n = 0; n <= 6; n++) {
    const words = dyckWords(n);
    const dinvOf = EXPECTED.Dinv!;
    const bounceOf = EXPECTED.Bounce!;
    const areaDinv = bivariatePolynomial(words, diagonalAreaOf, dinvOf);
    const bounceArea = bivariatePolynomial(words, bounceOf, diagonalAreaOf);
    expect(sortedEntries(bounceArea), `n=${n}`).toEqual(sortedEntries(areaDinv));

    // Symmetric in q and t: swapping (area, dinv) -> (dinv, area) reproduces the same
    // distribution, which is the q,t-Catalan symmetry theorem.
    const swapped = bivariatePolynomial(words, dinvOf, diagonalAreaOf);
    expect(sortedEntries(swapped), `n=${n} symmetry`).toEqual(sortedEntries(areaDinv));
  }
});

// A handful of pinned values, independent of the generating-function check above.
test("Dinv and Bounce golden values", () => {
  const cases: { word: number[]; dinv: number; bounce: number }[] = [
    { word: [1, 1, 0, 0, 1, 0], dinv: 2, bounce: 1 }, // UUDDUD
    { word: [1, 0, 1, 1, 0, 0], dinv: 1, bounce: 2 }, // UDUUDD
    { word: [1, 1, 1, 0, 0, 0], dinv: 0, bounce: 0 }, // UUUDDD
    { word: [1, 0, 1, 0, 1, 0], dinv: 3, bounce: 3 }, // UDUDUD
    { word: [1, 1, 0, 0], dinv: 0, bounce: 0 }, // UUDD
    { word: [1, 0, 1, 0], dinv: 1, bounce: 1 }, // UDUD
  ];
  for (const { word, dinv, bounce } of cases) {
    expect(evaluate("Dinv", word), `Dinv[${word}]`).toBe(dinv);
    expect(evaluate("Bounce", word), `Bounce[${word}]`).toBe(bounce);
  }
});
