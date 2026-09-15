import { expect, test } from "vite-plus/test";
import {
  ASSOCIAHEDRON,
  CROSS_POLYTOPE,
  PERMUTAHEDRON,
  type Polytope,
  SIMPLEX,
} from "../src/index.ts";
import { cast, faceNormal, orientedTo, rotated, scene, skeleton, stratum } from "../src/scene.ts";

const counts = (P: Polytope, n: number): Record<number, number> => {
  const out: Record<number, number> = {};
  for (const face of P.enumerate(n)) {
    const d = P.dimension(face);
    out[d] = (out[d] ?? 0) + 1;
  }
  return out;
};

/** How many vertices each 2-face has — the shape of every polygon on the picture. */
const ringSizes = (P: Polytope, n: number): number[] => {
  const points = scene(P, n);
  const vertices = stratum(points, 0);
  return stratum(points, 2)
    .map((face) => vertices.filter((v) => P.hasVertex(face.face, v.face)).length)
    .sort((a, b) => a - b);
};

test("the simplex is the Boolean lattice, so order 4 is a tetrahedron", () => {
  expect(counts(SIMPLEX, 4)).toEqual({ 0: 4, 1: 6, 2: 4, 3: 1 });
  expect(SIMPLEX.enumerate(5).length, "2^n - 1 faces").toBe(31);
  expect(ringSizes(SIMPLEX, 4), "four triangles").toEqual([3, 3, 3, 3]);
});

test("the cross-polytope is the octahedron at order 3 and the 16-cell at order 4", () => {
  expect(counts(CROSS_POLYTOPE, 3)).toEqual({ 0: 6, 1: 12, 2: 8, 3: 1 });
  expect(counts(CROSS_POLYTOPE, 4)).toEqual({ 0: 8, 1: 24, 2: 32, 3: 16, 4: 1 });
  expect(ringSizes(CROSS_POLYTOPE, 3), "eight triangles").toEqual([3, 3, 3, 3, 3, 3, 3, 3]);
});

test("the cross-polytope fills its ambient space rather than a hyperplane", () => {
  // The permutahedron's coordinates sum to a constant; the cross-polytope's do not, which is
  // why the cast reads a polytope's span off its vertices instead of assuming a hyperplane.
  const sums = (P: Polytope, n: number): number =>
    new Set(P.enumerate(n).map((f) => P.point(f).reduce((a, b) => a + b, 0))).size;
  expect(sums(PERMUTAHEDRON, 4)).toBe(1);
  expect(sums(CROSS_POLYTOPE, 4)).toBeGreaterThan(1);
  // The cast reads the rank off the vertices: four independent directions at order 4, where
  // the permutahedron of the same order spans only three. Scene space shows the leading three
  // either way, so the 16-cell is drawn as a projection — honestly a projection, not a solid.
  expect(cast(CROSS_POLYTOPE, 4).basis.length).toBe(4);
  expect(cast(PERMUTAHEDRON, 4).basis.length).toBe(3);
});

test("the associahedron's vertices are Catalan and its facets are 3 squares + 6 pentagons", () => {
  expect([1, 2, 3, 4, 5].map((n) => counts(ASSOCIAHEDRON, n)[0])).toEqual([1, 2, 5, 14, 42]);
  // The 3-D associahedron: 14 triangulations of a hexagon, 21 edges, 9 facets. Getting the
  // facet SHAPES right is the real check on Loday's coordinates — three squares and six
  // pentagons is what that solid is, and nothing here is told so.
  expect(counts(ASSOCIAHEDRON, 4)).toEqual({ 0: 14, 1: 21, 2: 9, 3: 1 });
  expect(ringSizes(ASSOCIAHEDRON, 4)).toEqual([4, 4, 4, 5, 5, 5, 5, 5, 5]);
  // Every face of an (n+2)-gon dissection: the little Schröder numbers.
  expect([2, 3, 4, 5].map((n) => ASSOCIAHEDRON.enumerate(n).length)).toEqual([3, 11, 45, 197]);
});

test("every polytope's 1-skeleton comes out of the poset", () => {
  for (const P of [SIMPLEX, CROSS_POLYTOPE, ASSOCIAHEDRON, PERMUTAHEDRON])
    for (const n of [3, 4]) {
      const points = scene(P, n);
      expect(skeleton(P, points).length, `${P.name} n=${n}`).toBe(stratum(points, 1).length);
    }
});

test("containment is an order on every polytope, with the body on top", () => {
  for (const P of [SIMPLEX, CROSS_POLYTOPE, ASSOCIAHEDRON]) {
    const faces = P.enumerate(3);
    const body = faces.find((f) => P.dimension(f) === P.dimensionAt(3))!;
    for (const face of faces) {
      expect(P.contains(face, face, 3), `${P.name} reflexive`).toBe(true);
      expect(P.contains(body, face, 3), `${P.name} body contains all`).toBe(true);
    }
    for (const a of faces)
      for (const b of faces)
        if (P.contains(a, b, 3))
          expect(P.dimension(a), `${P.name} monotone`).toBeGreaterThanOrEqual(P.dimension(b));
  }
});

test("a face's normal points out of the body, and the body has none", () => {
  const points = scene(CROSS_POLYTOPE, 3);
  for (const face of points) {
    const normal = faceNormal(CROSS_POLYTOPE, points, face);
    if (face.dimension === CROSS_POLYTOPE.dimensionAt(3)) {
      expect(normal, "the body has no normal").toBeUndefined();
      continue;
    }
    expect(normal).toBeDefined();
    expect(Math.hypot(...normal!), "unit").toBeCloseTo(1, 9);
    // Outward: it agrees with the direction from the centre to the face.
    const radial = Math.hypot(...face.at);
    if (radial > 1e-9)
      expect(
        normal!.reduce((sum, v, i) => sum + v * face.at[i]!, 0),
        "outward",
      ).toBeGreaterThan(0);
  }
  // A triangle of the octahedron is a plane, so its normal is orthogonal to all three edges.
  const triangle = stratum(points, 2)[0]!;
  const normal = faceNormal(CROSS_POLYTOPE, points, triangle)!;
  for (const vertex of stratum(points, 0).filter((v) =>
    CROSS_POLYTOPE.hasVertex(triangle.face, v.face),
  ))
    expect(
      normal.reduce((sum, v, i) => sum + v * (vertex.at[i]! - triangle.at[i]!), 0),
      "in the face's plane",
    ).toBeCloseTo(0, 9);
});

test("reorienting turns the chosen face towards the viewer, rigidly", () => {
  const points = scene(PERMUTAHEDRON, 4);
  const square = stratum(points, 2).slice(0, 1);
  const towards = [0, 0, 1] as const;
  const turned = orientedTo(PERMUTAHEDRON, points, square, towards);

  const after = turned.find((p) => p.face === square[0]!.face)!;
  const normal = faceNormal(PERMUTAHEDRON, turned, after)!;
  expect(normal[2], "now looking at the viewer").toBeCloseTo(1, 9);

  // Rigid: every pairwise distance is unchanged, so it is a rotation and not a distortion.
  for (const [i, a] of points.entries())
    for (const b of points.slice(i + 1, i + 4))
      expect(
        Math.hypot(...[0, 1, 2].map((k) => turned[i]!.at[k]! - turned[points.indexOf(b)]!.at[k]!)),
      ).toBeCloseTo(Math.hypot(...[0, 1, 2].map((k) => a.at[k]! - b.at[k]!)), 9);
});

test("an exactly opposed turn still works", () => {
  // No minimal rotation exists when the normal already points straight away from the viewer;
  // any perpendicular axis will do, and one has to be chosen rather than dividing by zero.
  const points = scene(SIMPLEX, 4);
  const face = stratum(points, 2)[0]!;
  const normal = faceNormal(SIMPLEX, points, face)!;
  const away = [-normal[0], -normal[1], -normal[2]] as const;
  const turned = rotated(points, normal, away);
  const after = turned.find((p) => p.face === face.face)!;
  expect(
    faceNormal(SIMPLEX, turned, after)!.reduce((s, v, i) => s + v * away[i]!, 0),
    "turned right around",
  ).toBeCloseTo(1, 9);
});

test("selecting only the body leaves the view alone", () => {
  const points = scene(SIMPLEX, 4);
  const body = points.filter((p) => p.dimension === 3);
  expect(orientedTo(SIMPLEX, points, body, [0, 0, 1])).toEqual(points);
});
