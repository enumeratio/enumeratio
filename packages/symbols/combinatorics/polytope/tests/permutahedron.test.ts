import { expect, test } from "vite-plus/test";
import { PERMUTAHEDRON as P } from "../src/permutahedron.ts";
import { centredOn, hyperplaneBasis, scene, skeleton, stratum } from "../src/scene.ts";

const faceCounts = (n: number): Record<number, number> => {
  const counts: Record<number, number> = {};
  for (const face of P.enumerate(n)) {
    const d = P.dimension(face);
    counts[d] = (counts[d] ?? 0) + 1;
  }
  return counts;
};

test("faces are set COMPOSITIONS, so the counts are Fubini not Bell", () => {
  // The distinction is the whole geometry. A restricted growth string discards block order
  // and would give the Bell numbers (1, 1, 2, 5, 15) — five faces for n = 3, which is a
  // different object. Ordered set partitions give 1, 1, 3, 13, 75.
  expect([0, 1, 2, 3, 4].map((n) => P.enumerate(n).length)).toEqual([1, 1, 3, 13, 75]);
});

test("order 3 is a hexagon and order 4 is a truncated octahedron", () => {
  expect(faceCounts(3)).toEqual({ 0: 6, 1: 6, 2: 1 });
  // 24 vertices, 36 edges, 14 two-faces (8 hexagons + 6 squares), 1 body.
  expect(faceCounts(4)).toEqual({ 0: 24, 1: 36, 2: 14, 3: 1 });
});

test("vertices are the permutations, doubled", () => {
  const vertices = P.enumerate(3)
    .filter((f) => P.dimension(f) === 0)
    .map((f) => P.point(f));
  expect(vertices.map((v) => v.join(","))).toEqual([
    "2,4,6",
    "2,6,4",
    "4,2,6",
    "4,6,2",
    "6,2,4",
    "6,4,2",
  ]);
});

test("every face's barycentre lies in the same hyperplane", () => {
  // Which is why the order-n permutahedron is (n-1)-dimensional, and why a projection is
  // needed at all rather than dropping a coordinate.
  for (const n of [2, 3, 4]) {
    const sums = P.enumerate(n).map((f) => P.point(f).reduce((a, b) => a + b, 0));
    expect(new Set(sums).size, `n=${n}`).toBe(1);
    expect(sums[0], `n=${n}`).toBe(n * (n + 1));
  }
});

test("vertex incidence is the primitive, and the poset order is derived from it", () => {
  // enumeratio's `contains_fn` answers "is this VERTEX on that face", which is what a viewer
  // needs and is not an order: a square is not one of its own vertices, so the relation is
  // not even reflexive. The face-poset order is derived — every vertex of the smaller face is
  // a vertex of the larger.
  const faces = P.enumerate(3);
  for (const face of faces) expect(P.contains(face, face, 3), "reflexive").toBe(true);
  for (const big of faces)
    for (const small of faces)
      if (P.contains(big, small, 3))
        expect(P.dimension(big), "a container is at least as big").toBeGreaterThanOrEqual(
          P.dimension(small),
        );
  // Transitive, which vertex incidence on its own would not give.
  for (const a of faces)
    for (const b of faces)
      for (const c of faces)
        if (P.contains(a, b, 3) && P.contains(b, c, 3))
          expect(P.contains(a, c, 3), "transitive").toBe(true);
});

test("the body contains every face, and a vertex contains only itself", () => {
  const faces = P.enumerate(3);
  const body = faces.find((f) => P.dimension(f) === 2)!;
  for (const face of faces) expect(P.contains(body, face, 3), "body contains all").toBe(true);
  for (const vertex of faces.filter((f) => P.dimension(f) === 0))
    expect(faces.filter((f) => P.contains(vertex, f, 3)).length, "a vertex is minimal").toBe(1);
});

test("the 1-skeleton comes out of the poset, not out of geometry", () => {
  // Every edge has exactly two vertices. That is a fact about the containment relation, and
  // the drawing follows from it — no geometric reasoning enters.
  for (const n of [3, 4]) {
    const points = scene(P, n);
    expect(skeleton(P, points).length, `n=${n}`).toBe(stratum(points, 1).length);
  }
});

test("the projection is faithful: the permutahedron is vertex-transitive", () => {
  // Every vertex the same distance from the centre. A projection that distorted the solid
  // would break this immediately, so it is a real check on the basis rather than a formality.
  for (const n of [3, 4]) {
    const radii = stratum(scene(P, n), 0).map((v) => Math.hypot(...v.at).toFixed(9));
    expect(new Set(radii).size, `n=${n}`).toBe(1);
  }
});

test("the hyperplane basis is orthonormal and spans n-1 dimensions", () => {
  for (const n of [2, 3, 4, 5]) {
    const basis = hyperplaneBasis(n);
    expect(basis.length, `n=${n}`).toBe(n - 1);
    for (const axis of basis) expect(Math.hypot(...axis), `n=${n} unit`).toBeCloseTo(1, 12);
    for (const [i, a] of basis.entries())
      for (const b of basis.slice(i + 1))
        expect(
          a.reduce((s, v, k) => s + v * b[k]!, 0),
          `n=${n} orthogonal`,
        ).toBeCloseTo(0, 12);
    // Orthogonal to (1,…,1) — that is the hyperplane the polytope lives in.
    for (const axis of basis)
      expect(
        axis.reduce((a, b) => a + b, 0),
        `n=${n} in hyperplane`,
      ).toBeCloseTo(0, 12);
  }
});

test("recentring on a selection puts its centroid at the origin", () => {
  const points = scene(P, 4);
  const square = stratum(points, 2).slice(0, 1);
  const moved = centredOn(points, square);
  const [x, y, z] = moved
    .filter((p) => square.some((s) => s.face === p.face))
    .reduce(([a, b, c], p) => [a + p.at[0], b + p.at[1], c + p.at[2]], [0, 0, 0]);
  expect(Math.hypot(x, y, z)).toBeCloseTo(0, 12);
  // Recentring moves everything together — the shape is unchanged.
  expect(moved.length).toBe(points.length);
});
