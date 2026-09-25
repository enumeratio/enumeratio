// The permutahedron: the convex hull of the permutations of (1, …, n).
//
// Faces are SET COMPOSITIONS of {1..n}: `labels[x]` is the block position of element x, so the
// all-singletons compositions are the n! vertices and the single block is the whole body.
//
//   dim      = n − (number of blocks)
//   point(x) = 2·|{l < labels[x]}| + |{l = labels[x]}| + 1
//
// The doubling is what keeps the coordinates integers: a face's barycentre is the mean of the
// vertices it spans, a half-integer whenever a block has even size.

import { type Face, polytope, type Polytope } from "./face.ts";

const blockCount = (labels: Face): number => (labels.length === 0 ? 0 : Math.max(...labels));

/**
 * Every set composition of {1..n}, as label words — a SURJECTIVE word onto 1..k for each k.
 *
 * Surjective, not restricted-growth. A restricted growth string labels blocks in order of first
 * appearance, which is exactly what makes it a set PARTITION: block order is discarded. A set
 * composition keeps that order, so every surjection is a distinct face, and the counts are the
 * Fubini numbers (1, 1, 3, 13, 75) rather than the Bell numbers.
 *
 * The distinction is the whole geometry here: the permutahedron of order 3 is a hexagon with 13
 * faces, and the 6 vertices are the 6 ORDERINGS of three singletons. Collapse the order and
 * five faces remain, which is a different object entirely.
 */
function setCompositions(n: number): Face[] {
  if (n === 0) return [[]];
  const out: Face[] = [];
  for (let blocks = 1; blocks <= n; blocks++) {
    const walk = (labels: number[]): void => {
      if (labels.length === n) {
        if (new Set(labels).size === blocks) out.push([...labels]);
        return;
      }
      for (let label = 1; label <= blocks; label++) walk([...labels, label]);
    };
    walk([]);
  }
  return out;
}

/** `image` is a vertex of the face `labels` when each element's value lies in its block's range. */
const hasVertex = (labels: Face, image: Face): boolean =>
  labels.every((_, x) => {
    const below = labels.filter((l) => l < labels[x]!).length;
    const upTo = labels.filter((l) => l <= labels[x]!).length;
    return image[x]! > below && image[x]! <= upTo;
  });

export const PERMUTAHEDRON: Polytope = polytope({
  name: "Permutahedron",
  faces: "set_composition",
  title: "Permutahedron",
  enumerate: setCompositions,
  dimension: (labels) => labels.length - blockCount(labels),
  point: (labels) =>
    labels.map(
      (_, x) => 2 * labels.filter((l) => l < labels[x]!).length + labels.filter((l) => l === labels[x]!).length + 1,
    ),
  hasVertex,
  dimensionAt: (n) => Math.max(n - 1, 0),
});
