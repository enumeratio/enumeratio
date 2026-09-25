// Permutations as data: cycle notation, one-line words, and the group they generate.
//
// A permutation of {1..n} is stored here as a plain array `sigma` of length n, 0-indexed,
// with `sigma[i-1] === sigma(i)` — the same one-line convention `SymmetricGroup`'s lazy
// family already uses (`packages/symbols/combinatorics/collections/src/families/core.ts`).
// Cycle notation (Wolfram's `Cycles[{{...}}, ...]`) is just another way to WRITE the same
// function: cycle `(i1 i2 … ik)` means `sigma(i1) = i2, …, sigma(ik) = i1`.
//
// `PermutationGroup` has no Cayley table to hand — only generators — so its elements are
// found by BFS closure rather than the `Group` abstraction in `./group.ts` (which wants
// the whole multiplication table up front). Capped, since a bad generator set can spin up
// an enormous group before anyone notices.

/** A single cycle: a list of DISTINCT positive integers, `(i1 i2 … ik)`. */
export type Cycle = readonly number[];

/** The identity permutation on `{1..n}`. */
export function identityPermutation(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1);
}

/** Cycle notation → one-line word of length `n` (padded with fixed points). */
export function cyclesToPermutation(cycles: readonly Cycle[], n: number): number[] {
  const sigma = identityPermutation(n);
  for (const cycle of cycles) {
    for (let k = 0; k < cycle.length; k++) {
      const from = cycle[k]!;
      const to = cycle[(k + 1) % cycle.length]!;
      sigma[from - 1] = to;
    }
  }
  return sigma;
}

/**
 * One-line word → cycle notation. Fixed points are omitted unless `includeFixed` is set
 * (Wolfram's `PermutationCycles[perm, f]` form keeps them as singleton cycles). Cycles are
 * ordered by, and each starts at, their smallest element — matching `PermutationCycles`.
 */
export function permutationToCycles(sigma: readonly number[], includeFixed = false): number[][] {
  const seen = new Set<number>();
  const cycles: number[][] = [];
  for (let start = 1; start <= sigma.length; start++) {
    if (seen.has(start)) continue;
    const fixed = sigma[start - 1] === start;
    if (fixed && !includeFixed) {
      seen.add(start);
      continue;
    }
    const cycle = [start];
    seen.add(start);
    let cur = sigma[start - 1]!;
    while (cur !== start) {
      cycle.push(cur);
      seen.add(cur);
      cur = sigma[cur - 1]!;
    }
    cycles.push(cycle);
  }
  return cycles;
}

/** Are these cycles pairwise disjoint, each entry a positive integer, each cycle non-repeating? */
export function cyclesAreValid(cycles: readonly Cycle[]): boolean {
  const seen = new Set<number>();
  for (const cycle of cycles) {
    const within = new Set<number>();
    for (const x of cycle) {
      if (!Number.isSafeInteger(x) || x < 1) return false;
      if (within.has(x) || seen.has(x)) return false;
      within.add(x);
      seen.add(x);
    }
  }
  return true;
}

/** Drop singleton (fixed-point) cycles — `Cycles`'s own canonical form. */
export const dropFixedCycles = (cycles: readonly Cycle[]): Cycle[] =>
  cycles.filter((cycle) => cycle.length > 1);

/** The inverse permutation: reverse the mapping. */
export function invertPermutation(sigma: readonly number[]): number[] {
  const inverse = new Array<number>(sigma.length);
  sigma.forEach((value, i) => {
    inverse[value - 1] = i + 1;
  });
  return inverse;
}

/** Compose `sigma` and `tau`, both on `{1..n}`: apply `sigma` then `tau`. */
export function composePermutations(sigma: readonly number[], tau: readonly number[]): number[] {
  return sigma.map((value) => tau[value - 1]!);
}

/**
 * Permute a list positionally: the item at position `i` moves to position `sigma(i)`.
 * Positions past `sigma`'s length are left untouched.
 */
export function applyPermutation<T>(items: readonly T[], sigma: readonly number[]): T[] {
  const result = items.slice();
  sigma.forEach((target, i) => {
    if (i < items.length && target >= 1 && target <= items.length) {
      result[target - 1] = items[i]!;
    }
  });
  return result;
}

/** BFS closure of a permutation group from its generators — every group element, once. */
export function permutationGroupClosure(
  generators: readonly (readonly number[])[],
  degree: number,
  cap = 50_000,
): number[][] | undefined {
  const key = (p: readonly number[]) => p.join(",");
  const id = identityPermutation(degree);
  const seen = new Map<string, number[]>([[key(id), id]]);
  const queue: number[][] = [id];
  while (queue.length > 0) {
    const g = queue.shift()!;
    for (const gen of generators) {
      const h = composePermutations(g, gen);
      const k = key(h);
      if (!seen.has(k)) {
        if (seen.size >= cap) return undefined;
        seen.set(k, h);
        queue.push(h);
      }
    }
  }
  // Canonical order: by the cycle-notation reading, which is what Wolfram's own
  // `GroupElements[PermutationGroup[...]]` output sorts by (identity first, then by
  // ascending support). Sorting the one-line words lexicographically reaches the same
  // order in every case that matters here — a plain array is easiest to compare.
  return [...seen.values()].sort((a, b) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
    return 0;
  });
}
