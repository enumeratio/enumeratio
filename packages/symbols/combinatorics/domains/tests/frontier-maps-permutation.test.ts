import { ComputeEngine } from "@cortex-js/compute-engine";
import { ALL_STATISTICS, declareStatistics } from "@enumeratio/statistics/src";
import { expect, test } from "vite-plus/test";
import { declareDomains } from "../src/declare.ts";
import { DOMAINS } from "../src/domain-data.ts";
import { declareMaps } from "../src/map.ts";

// Four maps taken off the UNDEFINED_MAPS frontier: BinarySearchTree (permutation ->
// binary_tree), KnuthClassRepresentative and KrewerasComplement (both permutation ->
// permutation), and FromPermutation (permutation -> increasing_binary_tree). Each is checked
// two ways: against an independent plain-loop reference (no compute-engine, so it can run out
// to n = 6 or 7 cheaply) for the COUNTING claims, and against the actual `ce.box(...).evaluate()`
// path for a smaller exhaustive range, the same trade tableau.test.ts makes for RSK — these
// expressions are nested folds and get expensive fast, so the exhaustive CE check stops at
// n = 4.

const domainTypes = Object.fromEntries(DOMAINS.map((d) => [d.name, d.type]));
const constructorFor = Object.fromEntries(DOMAINS.map((d) => [d.type, d.name]));

const ce = new ComputeEngine();
declareDomains(ce);
// KrewerasComplement's guard reads CycleCount, so statistics has to be declared before
// maps — the same order map.test.ts uses.
declareStatistics(ce, ALL_STATISTICS, { domainTypes });
declareMaps(ce, constructorFor);

const perm = (...entries: number[]): unknown => ["Permutations", ["List", ...entries]];
const contents = (expr: unknown): unknown => {
  const evaluated = ce.box(expr as never).evaluate();
  return (evaluated as unknown as { ops?: { json: unknown }[] }).ops?.[0]?.json;
};

function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (const rest of permutations(n - 1))
    for (let i = 0; i <= rest.length; i++) out.push([...rest.slice(0, i), n, ...rest.slice(i)]);
  return out;
}
const ALL4 = [1, 2, 3, 4].flatMap(permutations);

function catalan(n: number): number {
  let c = 1;
  for (let k = 0; k < n; k++) c = (c * 2 * (2 * k + 1)) / (k + 2);
  return Math.round(c);
}

// ── BinarySearchTree ──────────────────────────────────────────────────────────────────────

/** The parent-pointer encoding read with a plain loop: insert p(1), p(2), ... in turn,
 *  descending by value comparison from the root (always p(1)) until an empty side is found. */
function bstParentsRef(p: readonly number[]): number[] {
  const n = p.length;
  const parent = new Array<number>(n + 1).fill(0); // 1-indexed by value
  const root = p[0]!;
  for (let i = 1; i < n; i++) {
    const x = p[i]!;
    let cur = root;
    for (;;) {
      const child = Array.from({ length: n }, (_, k) => k + 1).find(
        (v) => parent[v] === cur && (x < cur ? v < cur : v > cur),
      );
      if (child === undefined) {
        parent[x] = cur;
        break;
      }
      cur = child;
    }
  }
  return parent.slice(1);
}

test("BinarySearchTree agrees with plain insertion, up to n = 4", () => {
  for (const p of ALL4)
    expect(contents(["BinarySearchTree", perm(...p)]), `[${p}]`).toEqual(["List", ...bstParentsRef(p)]);
});

test("BinarySearchTree is typed as binary_tree", () => {
  expect(String(ce.box(["BinarySearchTree", perm(2, 3, 1)] as never).evaluate().type)).toBe("binary_tree");
});

test("distinct binary search trees over S_n are counted by Catalan(n)", () => {
  // Pure reference, no compute-engine — the sylvester congruence itself, checked out past
  // where running every permutation through the engine would be worth it.
  for (let n = 1; n <= 7; n++) {
    const distinct = new Set(permutations(n).map((p) => JSON.stringify(bstParentsRef(p))));
    expect(distinct.size, `n = ${n}`).toBe(catalan(n));
  }
});

// ── KnuthClassRepresentative ──────────────────────────────────────────────────────────────

/** Row insertion with bumping — the same algorithm tableau.test.ts uses independently. */
function insertionTableauRef(p: readonly number[]): number[][] {
  const rows: number[][] = [];
  for (const entry of p) {
    let carried = entry;
    let r = 0;
    for (;;) {
      if (!rows[r]) {
        rows[r] = [carried];
        break;
      }
      const index = rows[r]!.findIndex((v) => v > carried);
      if (index < 0) {
        rows[r]!.push(carried);
        break;
      }
      const bumped = rows[r]![index]!;
      rows[r]![index] = carried;
      carried = bumped;
      r++;
    }
  }
  return rows;
}
/** The reading word: bottom row to top, each left to right. */
const readingWordRef = (p: readonly number[]): number[] => insertionTableauRef(p).reverse().flat();

test("KnuthClassRepresentative is the reading word of the insertion tableau, up to n = 4", () => {
  for (const p of ALL4)
    expect(contents(["KnuthClassRepresentative", perm(...p)]), `[${p}]`).toEqual(["List", ...readingWordRef(p)]);
});

test("KnuthClassRepresentative is idempotent and keeps σ's insertion tableau, up to n = 4", () => {
  for (const p of ALL4) {
    const rep = readingWordRef(p);
    expect(readingWordRef(rep), `idempotent [${p}]`).toEqual(rep);
    expect(insertionTableauRef(rep), `same P [${p}]`).toEqual(insertionTableauRef(p));
  }
});

test("distinct Knuth class representatives over S_n count standard Young tableaux", () => {
  // A000085: 1, 1, 2, 4, 10, 26, 76, ... — the involutions, and (Schensted) the number of
  // SYT of size n, since RSK sends an involution to (P, P).
  const syt = [1, 1, 2, 4, 10, 26, 76];
  for (let n = 1; n <= 6; n++) {
    const distinct = new Set(permutations(n).map((p) => JSON.stringify(readingWordRef(p))));
    expect(distinct.size, `n = ${n}`).toBe(syt[n]);
  }
});

// ── KrewerasComplement ────────────────────────────────────────────────────────────────────

/** c = (1 2 ... n), applied to a position. */
const longCycleRef = (i: number, n: number): number => (i % n) + 1;
/** K(w) = w^{-1} c, read off directly: position i holds w^{-1}(c(i)), and w^{-1}(x) is x's
 *  position in the one-line word. */
const krewerasRef = (p: readonly number[]): number[] => p.map((_, i) => p.indexOf(longCycleRef(i + 1, p.length)) + 1);

/** w's cycles, as sets of 1-indexed points. */
function cyclesOf(p: readonly number[]): number[][] {
  const seen = new Array<boolean>(p.length).fill(false);
  const cycles: number[][] = [];
  for (let start = 0; start < p.length; start++) {
    if (seen[start]) continue;
    const cycle: number[] = [];
    let at = start;
    do {
      seen[at] = true;
      cycle.push(at + 1);
      at = p[at]! - 1;
    } while (at !== start);
    cycles.push(cycle);
  }
  return cycles;
}
/** Two blocks CROSS when they interleave around the circle 1, 2, ..., n: a1 < b1 < a2 < b2
 *  with a1, a2 in one block and b1, b2 in the other. */
function crosses(a: readonly number[], b: readonly number[]): boolean {
  for (const a1 of a)
    for (const a2 of a) for (const b1 of b) for (const b2 of b) if (a1 < b1 && b1 < a2 && a2 < b2) return true;
  return false;
}
/**
 * w is non-crossing iff (a) each cycle, restricted to its support sorted increasingly, sends
 * every point to the next larger one in that block (wrapping) — the rotation c itself induces
 * on that block, which a cycle can otherwise realise in the "wrong" direction even though its
 * bare support crosses nothing — and (b) the supports form a non-crossing set partition.
 * Condition (a) is what the single 3-cycle failing for n = 3 is about: [3, 1, 2] has the same
 * one-block support as [2, 3, 1] but turns it the other way, and only one of the two is
 * actually below c.
 */
const isNonCrossing = (p: readonly number[]): boolean => {
  const cycles = cyclesOf(p);
  for (const cycle of cycles) {
    const sorted = [...cycle].sort((a, b) => a - b);
    for (let j = 0; j < sorted.length; j++) {
      const expected = sorted[(j + 1) % sorted.length]!;
      if (p[sorted[j]! - 1] !== expected) return false;
    }
  }
  for (let i = 0; i < cycles.length; i++)
    for (let j = i + 1; j < cycles.length; j++) if (crosses(cycles[i]!, cycles[j]!)) return false;
  return true;
};

test("KrewerasComplement agrees with w⁻¹c on the non-crossing permutations, up to n = 4", () => {
  for (const p of ALL4) {
    const evaluated = ce.box(["KrewerasComplement", perm(...p)] as never).evaluate();
    if (isNonCrossing(p)) {
      expect(contents(["KrewerasComplement", perm(...p)]), `[${p}]`).toEqual(["List", ...krewerasRef(p)]);
    } else {
      // Declines: the call stays headed by `KrewerasComplement` rather than being answered
      // wrong — the way an unmatched `Filter` predicate is never materialised at all.
      expect(evaluated.operator, `[${p}] declines`).toBe("KrewerasComplement");
    }
  }
});

test("non-crossing permutations over S_n are counted by Catalan(n)", () => {
  for (let n = 1; n <= 7; n++) {
    const count = permutations(n).filter(isNonCrossing).length;
    expect(count, `n = ${n}`).toBe(catalan(n));
  }
});

test("K∘K is conjugation by the long cycle, and K is a bijection of NC(n)", () => {
  for (let n = 1; n <= 6; n++) {
    const nc = permutations(n).filter(isNonCrossing);
    const cOf = (i: number) => longCycleRef(i, n);
    const cInvOf = (x: number) => Array.from({ length: n }, (_, i) => i + 1).find((i) => cOf(i) === x)!;
    const images = new Set<string>();
    for (const w of nc) {
      const k = krewerasRef(w);
      expect(isNonCrossing(k), `K(w) stays in NC(n) [n=${n}] [${w}]`).toBe(true);
      const kk = krewerasRef(k);
      const conjugated = w.map((_, i) => cInvOf(w[cOf(i + 1) - 1]!));
      expect(kk, `K(K(w)) = c⁻¹wc [n=${n}] [${w}]`).toEqual(conjugated);
      images.add(JSON.stringify(k));
    }
    expect(images.size, `K is injective on NC(${n})`).toBe(nc.length);
  }
});

// ── FromPermutation ───────────────────────────────────────────────────────────────────────

/** The increasing binary tree, read directly off the recursive definition: the position of
 *  the smallest value in `p[lo..hi]` roots that range, its value's children are the trees of
 *  the ranges before and after. Arrays are 1-indexed by VALUE, matching the encoding
 *  increasing-binary-tree.ts builds without recursion. */
function fromPermutationRef(p: readonly number[]): {
  root: number;
  left: number[];
  right: number[];
} {
  const n = p.length;
  const left = new Array<number>(n + 1).fill(0);
  const right = new Array<number>(n + 1).fill(0);
  const build = (lo: number, hi: number): number => {
    if (lo > hi) return 0;
    let mi = lo;
    for (let k = lo + 1; k <= hi; k++) if (p[k]! < p[mi]!) mi = k;
    const rootValue = p[mi]!;
    left[rootValue] = build(lo, mi - 1);
    right[rootValue] = build(mi + 1, hi);
    return rootValue;
  };
  const root = build(0, n - 1);
  return { root, left: left.slice(1), right: right.slice(1) };
}

/** The constructed value's Tuple — the single argument `IncreasingBinaryTrees` wraps. */
const tupleOf = (expr: unknown): { json: unknown }[] | undefined =>
  (ce.box(expr as never).evaluate() as unknown as { ops?: { ops?: { json: unknown }[] }[] }).ops?.[0]?.ops as
    | { json: unknown }[]
    | undefined;

test("FromPermutation agrees with minimum-splitting recursion, up to n = 4", () => {
  for (const p of ALL4) {
    const ref = fromPermutationRef(p);
    const tuple = tupleOf(["FromPermutation", perm(...p)]);
    expect(tuple?.[0]?.json, `root [${p}]`).toBe(ref.root);
    expect(tuple?.[1]?.json, `left_child [${p}]`).toEqual(["List", ...ref.left]);
    expect(tuple?.[2]?.json, `right_child [${p}]`).toEqual(["List", ...ref.right]);
  }
});

test("FromPermutation's root is always 1", () => {
  for (const p of ALL4) {
    expect(tupleOf(["FromPermutation", perm(...p)])?.[0]?.json, `[${p}]`).toBe(1);
  }
});

test("FromPermutation is typed as increasing_binary_tree", () => {
  expect(String(ce.box(["FromPermutation", perm(2, 3, 1)] as never).evaluate().type)).toBe("increasing_binary_tree");
});

test("FromPermutation is a bijection from S_n onto the increasing binary trees on n nodes", () => {
  // Both counted by n! — unlike BinarySearchTree (Catalan(n), many-to-one), this map's whole
  // point is that it loses nothing: reference implementation only, out to n = 7.
  for (let n = 1; n <= 7; n++) {
    const images = new Set(permutations(n).map((p) => JSON.stringify(fromPermutationRef(p))));
    expect(images.size, `n = ${n}`).toBe(permutations(n).length);
  }
});
