// The hypercube: [−1, 1]^n. The DUAL reading of the signed-subset carrier the cross-polytope
// uses — same word over {−1, 0, +1} per axis, opposite meaning.
//
// A face fixes some axes to ±1 (the walls it sits on) and leaves the rest FREE (0, ranging over
// the whole [−1, 1] on that axis):
//
//   dim = n − (number of fixed axes)
//
// so the all-zero word is the BODY (no axis fixed, dim n) and a fully-signed word is a vertex
// (every axis fixed, dim 0) — the reverse of the cross-polytope, where nonzero entries are the
// ones a face spans and the all-zero word is the body only because no proper pattern claims it.
// Containment follows: `big` contains `small`'s vertices exactly when every axis `big` fixes
// agrees with `small` — a free axis in `big` constrains nothing, so the all-zero body passes
// trivially and needs no special case.

import { type Face, polytope, type Polytope } from "./face.ts";

const fixed = (signs: Face): number => signs.filter((s) => s !== 0).length;

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

export const HYPERCUBE: Polytope = polytope({
  name: "Hypercube",
  faces: "signed_subset",
  title: "Hypercube",
  enumerate: (n) => (n === 0 ? [] : signedSubsets(n)),
  dimension: (signs) => signs.length - fixed(signs),
  // A face's barycentre: ±1 on the axes it fixes, 0 (the midpoint of [−1, 1]) on the free ones —
  // already exact integers, so unlike the other polytopes here no shared scale is needed.
  point: (signs) => signs.map((sign) => sign),
  hasVertex: (big, vertex) => big.every((sign, i) => sign === 0 || vertex[i] === sign),
  dimensionAt: (n) => n,
});
