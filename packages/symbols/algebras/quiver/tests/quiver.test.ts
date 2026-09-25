import { expect, test } from "vite-plus/test";
import {
  adjacency,
  allPaths,
  concatenate,
  hasCycle,
  isPath,
  jordanQuiver,
  kroneckerQuiver,
  linearQuiver,
  type Path,
  pathAlgebraDimension,
  pathEnd,
  pathKey,
  quiver,
  type Quiver,
} from "../src/quiver.ts";

/** Independent path count, from powers of the adjacency matrix. */
const pathsByMatrix = (q: Quiver): number => {
  const n = q.vertices;
  const a = adjacency(q);
  let power: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j): number => (i === j ? 1 : 0)),
  );
  let total = 0;
  // Paths of length 0 are the vertices; length ℓ paths are the entries of A^ℓ. An
  // acyclic quiver on n vertices has no path longer than n − 1.
  for (let step = 0; step < n; step++) {
    total += power.flat().reduce<number>((acc, x) => acc + x, 0);
    power = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, k) => {
        let sum = 0;
        for (let j = 0; j < n; j++) sum += power[i]![j]! * a[j]![k]!;
        return sum;
      }),
    );
  }
  return total;
};

test("cycles are detected, including loops", () => {
  expect(hasCycle(jordanQuiver())).toBe(true); // a loop is a cycle
  expect(hasCycle(linearQuiver(4)!)).toBe(false);
  expect(hasCycle(kroneckerQuiver())).toBe(false); // parallel arrows, but acyclic
  const twoCycle = quiver("two-cycle", 2, [
    { from: 1, to: 2 },
    { from: 2, to: 1 },
  ])!;
  expect(hasCycle(twoCycle)).toBe(true);
});

test("a cyclic quiver has NO finite basis, and says so", () => {
  // The edge no other family here has: the algebra is infinite-dimensional.
  expect(allPaths(jordanQuiver())).toBeUndefined();
  expect(pathAlgebraDimension(jordanQuiver())).toBeUndefined();
});

test("the path count agrees with the adjacency-matrix count", () => {
  // Enumeration versus linear algebra — two independent routes to the dimension.
  const quivers: Quiver[] = [
    linearQuiver(1)!,
    linearQuiver(2)!,
    linearQuiver(4)!,
    linearQuiver(6)!,
    kroneckerQuiver(),
    quiver("fork", 3, [
      { from: 1, to: 2 },
      { from: 1, to: 3 },
    ])!,
    quiver("diamond", 4, [
      { from: 1, to: 2 },
      { from: 1, to: 3 },
      { from: 2, to: 4 },
      { from: 3, to: 4 },
    ])!,
  ];
  for (const q of quivers) {
    expect(pathAlgebraDimension(q), q.name).toBe(pathsByMatrix(q));
  }
});

test("A_n's path algebra has the same dimension as a chain's incidence algebra", () => {
  // Its paths are exactly the pairs i ≤ j, so both count C(n+1,2). The two libraries
  // describe the same algebra from different directions.
  for (const n of [1, 2, 3, 4, 5, 6]) {
    expect(pathAlgebraDimension(linearQuiver(n)!), `A_${n}`).toBe((n * (n + 1)) / 2);
  }
});

test("the Kronecker quiver: two vertices, two arrows, four paths", () => {
  const q = kroneckerQuiver();
  const paths = allPaths(q)!;
  expect(paths.length).toBe(4); // e_1, e_2, and the two arrows
  expect(paths.filter((p) => p.arrows.length === 0).length).toBe(2);
  expect(paths.filter((p) => p.arrows.length === 1).length).toBe(2);
  // Parallel arrows are DISTINCT basis elements, even with the same endpoints.
  const [a, b] = paths.filter((p) => p.arrows.length === 1);
  expect(pathKey(a!)).not.toBe(pathKey(b!));
});

test("every enumerated path really is a path", () => {
  for (const q of [linearQuiver(5)!, kroneckerQuiver()]) {
    for (const p of allPaths(q)!) expect(isPath(q, p), pathKey(p)).toBe(true);
  }
  // And a fabricated one is not.
  const q = linearQuiver(3)!;
  expect(isPath(q, { start: 1, arrows: [1] })).toBe(false); // arrow 1 starts at vertex 2
  expect(isPath(q, { start: 9, arrows: [] })).toBe(false);
});

test("concatenation composes when the ends meet, and is zero otherwise", () => {
  const q = linearQuiver(4)!;
  const a: Path = { start: 1, arrows: [0] }; // 1→2
  const b: Path = { start: 2, arrows: [1] }; // 2→3
  const joined = concatenate(q, a, b)!;
  expect(joined.start).toBe(1);
  expect(pathEnd(q, joined)).toBe(3);
  // b then a does NOT compose — that is the zero of the algebra.
  expect(concatenate(q, b, a)).toBeUndefined();
});

test("concatenation is associative, and trivial paths are the local identities", () => {
  const q = quiver("diamond", 4, [
    { from: 1, to: 2 },
    { from: 1, to: 3 },
    { from: 2, to: 4 },
    { from: 3, to: 4 },
  ])!;
  const paths = allPaths(q)!;
  for (const a of paths) {
    // e_{start} · a = a and a · e_{end} = a.
    expect(pathKey(concatenate(q, { start: a.start, arrows: [] }, a)!)).toBe(pathKey(a));
    expect(pathKey(concatenate(q, a, { start: pathEnd(q, a), arrows: [] })!)).toBe(pathKey(a));
    for (const b of paths) {
      for (const c of paths) {
        const left = concatenate(q, a, b);
        const right = concatenate(q, b, c);
        const viaLeft = left === undefined ? undefined : concatenate(q, left, c);
        const viaRight = right === undefined ? undefined : concatenate(q, a, right);
        expect(viaLeft === undefined ? undefined : pathKey(viaLeft)).toEqual(
          viaRight === undefined ? undefined : pathKey(viaRight),
        );
      }
    }
  }
});

test("a malformed quiver yields nothing", () => {
  expect(quiver("bad", 0, [])).toBeUndefined();
  expect(quiver("bad", 2, [{ from: 1, to: 5 }])).toBeUndefined();
});
