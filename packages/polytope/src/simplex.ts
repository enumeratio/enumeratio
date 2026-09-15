// The simplex: the convex hull of e_1, …, e_n.
//
// Its face poset is the Boolean lattice with the empty set removed — a face IS a nonempty
// subset of {1..n}, its vertices are the singletons it contains, and containment is inclusion.
// That makes it the simplest possible check on everything the general machinery does: 2^n − 1
// faces, C(n, k+1) of dimension k, and the whole set as the body.
//
// Carried as a 0/1 word, matching enumeratio's `subset`, so the face data reads the same way in
// a `data-face` attribute as everywhere else.

import { factorial, type Face, polytope, type Polytope } from "./face.ts";

const size = (subset: Face): number => subset.reduce((sum, bit) => sum + bit, 0);

function nonemptySubsets(n: number): Face[] {
  const out: Face[] = [];
  for (let mask = 1; mask < 1 << n; mask++)
    out.push(Array.from({ length: n }, (_, i) => ((mask >> i) & 1) as number));
  return out;
}

export const SIMPLEX: Polytope = polytope({
  name: "Simplex",
  faces: "subset",
  title: "Simplex",
  enumerate: (n) => (n === 0 ? [] : nonemptySubsets(n)),
  dimension: (subset) => size(subset) - 1,
  // The barycentre is the indicator over its own size; n! clears every denominator at once.
  point: (subset) => subset.map((bit) => (bit * factorial(subset.length)) / size(subset)),
  hasVertex: (big, vertex) => vertex.every((bit, i) => bit === 0 || big[i] === 1),
  dimensionAt: (n) => Math.max(n - 1, 0),
});
