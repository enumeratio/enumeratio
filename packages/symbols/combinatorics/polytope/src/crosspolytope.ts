// The cross-polytope: the convex hull of ±e_1, …, ±e_n. The octahedron at order 3.
//
// A proper face is a SIGNED SUBSET — pick a set of axes and a sign on each — because a face is
// spanned by at most one of each opposite pair of vertices. Carried as a word over {−1, 0, +1}:
//
//   dim  = (number of nonzero entries) − 1
//
// The all-zero word is the one face that is not a signed subset, and it is the BODY. That is
// not a special case smuggled in: the body genuinely is the face no proper sign pattern names,
// and giving it the empty pattern keeps the carrier one uniform shape.
//
// Unlike the permutahedron and simplex this one does NOT lie in a hyperplane — it fills R^n —
// which is the reason the scene cast reads a polytope's span off its vertices instead of
// assuming one.

import { factorial, type Face, polytope, type Polytope } from "./face.ts";

const support = (signs: Face): number => signs.filter((s) => s !== 0).length;

function signedSubsets(n: number): Face[] {
  const out: Face[] = [];
  const walk = (signs: number[]): void => {
    if (signs.length === n) {
      out.push([...signs]);
      return;
    }
    for (const sign of [0, 1, -1]) walk([...signs, sign]);
  };
  walk([]);
  return out;
}

export const CROSS_POLYTOPE: Polytope = polytope({
  name: "CrossPolytope",
  faces: "signed_subset",
  title: "Cross-polytope",
  enumerate: (n) => (n === 0 ? [] : signedSubsets(n)),
  dimension: (signs) => (support(signs) === 0 ? signs.length : support(signs) - 1),
  // Mean of the signed unit vectors it spans; the body sits at the origin either way.
  point: (signs) => signs.map((sign) => (support(signs) === 0 ? 0 : (sign * factorial(signs.length)) / support(signs))),
  hasVertex: (big, vertex) => support(big) === 0 || vertex.every((sign, i) => sign === 0 || big[i] === sign),
  dimensionAt: (n) => n,
});
