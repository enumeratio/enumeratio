// The associahedron: the polytope of ways to bracket a product.
//
// Its faces are the DISSECTIONS of a convex (n+2)-gon — sets of pairwise noncrossing diagonals
// — ordered by reverse inclusion. Adding a diagonal cuts the polygon further and so cuts the
// face down:
//
//   dim  = (n − 1) − (number of diagonals)
//
// so the empty dissection is the body, a full triangulation is a vertex, and the vertex count
// is Catalan. A face is carried as a 0/1 word over the polygon's diagonals in a fixed order,
// which keeps it the same shape as every other carrier here and lets the order n be read back
// out of the word's LENGTH — a dissection that happens to use no diagonal near the last corner
// would otherwise be indistinguishable from one of a smaller polygon.
//
// The coordinates are Loday's. Read a triangulation as a binary tree by taking the side
// (0, n+1) as the root and recursing on the triangle that meets it; the i-th coordinate is then
// the product of the leaf counts hanging left and right of the i-th internal node. Those points
// are the true vertices of the associahedron, and a face's point is the mean of the vertices it
// contains — the barycentre, exactly as for every other polytope here.

import { type Face, polytope, type Polytope } from "./face.ts";

/** Every diagonal of an (n+2)-gon, as `[i, j]` with `i < j` — the sides and the root edge
 *  (0, n+1) excluded, since those lie in every dissection and so name nothing. */
function diagonals(n: number): [number, number][] {
  const corners = n + 2;
  const out: [number, number][] = [];
  for (let i = 0; i < corners; i++)
    for (let j = i + 2; j < corners; j++) if (!(i === 0 && j === corners - 1)) out.push([i, j]);
  return out;
}

/** The order a face belongs to, from its width: an (n+2)-gon has (n+2)(n−1)/2 diagonals. */
const orderOf = (face: Face): number => Math.round((Math.sqrt(9 + 8 * face.length) - 1) / 2);

/** Two diagonals cross when each separates the other's endpoints. */
const crosses = (a: readonly [number, number], b: readonly [number, number]): boolean =>
  (a[0] < b[0] && b[0] < a[1] && a[1] < b[1]) || (b[0] < a[0] && a[0] < b[1] && b[1] < a[1]);

const size = (face: Face): number => face.reduce((sum, bit) => sum + bit, 0);

/** `small`'s diagonals are all `big`'s — inclusion of dissections. */
const refines = (big: Face, small: Face): boolean => small.every((bit, i) => !bit || big[i] === 1);

/** Every dissection of an (n+2)-gon as an indicator word, body first — grouped by size, so the
 *  enumeration runs from the whole body down to the triangulations. */
const dissections = memo((n: number): Face[] => {
  const all = diagonals(n);
  const byCount: Face[][] = [];
  const word = Array.from({ length: all.length }, () => 0);
  const walk = (from: number, count: number): void => {
    (byCount[count] ??= []).push([...word]);
    for (let i = from; i < all.length; i++)
      if (!all.some((d, k) => word[k] === 1 && crosses(d, all[i]!))) {
        word[i] = 1;
        walk(i + 1, count + 1);
        word[i] = 0;
      }
  };
  walk(0, 0);
  return byCount.flat();
});

/** The triangulations of the (n+2)-gon: the dissections nothing refines further. */
const triangulations = memo((n: number): Face[] =>
  dissections(n).filter((face) => size(face) === n - 1),
);

/**
 * Loday's point for one triangulation of the (n+2)-gon.
 *
 * `leaves(a, b)` walks the sub-polygon from corner `a` to corner `b`: a side is a leaf, and
 * anything longer splits at the one corner `k` the triangulation joins to both ends. Corner `k`
 * is the internal node between those two subtrees, so its coordinate is the product of their
 * leaf counts.
 */
function lodayPoint(n: number, triangulation: Face): number[] {
  const all = diagonals(n);
  const chords = new Set<string>([
    `0:${n + 1}`,
    ...Array.from({ length: n + 1 }, (_, i) => `${i}:${i + 1}`),
    ...all.filter((_, i) => triangulation[i] === 1).map(([i, j]) => `${i}:${j}`),
  ]);
  const point = Array.from({ length: n }, () => 0);
  const leaves = (a: number, b: number): number => {
    if (b === a + 1) return 1;
    for (let k = a + 1; k < b; k++)
      if (chords.has(`${a}:${k}`) && chords.has(`${k}:${b}`)) {
        const left = leaves(a, k);
        const right = leaves(k, b);
        point[k - 1] = left * right;
        return left + right;
      }
    return 1; // unreachable for a genuine triangulation
  };
  leaves(0, n + 1);
  return point;
}

export const ASSOCIAHEDRON: Polytope = polytope({
  name: "Associahedron",
  faces: "dissection",
  title: "Associahedron",
  enumerate: (n) => (n < 1 ? [] : dissections(n)),
  dimension: (face) => orderOf(face) - 1 - size(face),
  point: (face) => {
    const n = orderOf(face);
    const spanning = triangulations(n).filter((vertex) => refines(vertex, face));
    return Array.from(
      { length: n },
      (_, i) =>
        spanning.reduce((sum, vertex) => sum + lodayPoint(n, vertex)[i]!, 0) / spanning.length,
    );
  },
  // A triangulation is a vertex of a dissection precisely when it refines it.
  hasVertex: (big, vertex) => refines(vertex, big),
  dimensionAt: (n) => Math.max(n - 1, 0),
});

function memo<T>(f: (n: number) => T): (n: number) => T {
  const seen = new Map<number, T>();
  return (n) => {
    const already = seen.get(n);
    if (already !== undefined) return already;
    const value = f(n);
    seen.set(n, value);
    return value;
  };
}
