import { expect, test } from "vite-plus/test";
import { type Diagram, diagramKey, enumerateDiagrams } from "../src/diagram.ts";
import { bell } from "../src/dimensions.ts";
import {
  type AlgebraElement,
  basisElement,
  blockCount,
  coarsenings,
  diagramProduct,
  diagramToOrbit,
  element,
  orbitToDiagram,
  partitionMobius,
  refines,
} from "../src/orbit.ts";

const show = (e: AlgebraElement) =>
  [...e.values()]
    .map(({ diagram: d, coefficient }) => [diagramKey(d), coefficient] as const)
    .sort(([a], [b]) => (a < b ? -1 : 1));
const same = (a: AlgebraElement, b: AlgebraElement) => expect(JSON.stringify(show(a))).toBe(JSON.stringify(show(b)));

const partitions = (n: number): Diagram[] => enumerateDiagrams("partition", n);

test("coarsening is partitioning the blocks, so there are Bell(k) of them", () => {
  for (let n = 1; n <= 3; n++) {
    for (const d of partitions(n)) {
      expect(coarsenings(d).length, diagramKey(d)).toBe(bell(blockCount(d)));
      // Every coarsening really is coarser, and distinct.
      const keys = new Set<string>();
      for (const c of coarsenings(d)) {
        expect(refines(d, c), diagramKey(d)).toBe(true);
        expect(blockCount(c), diagramKey(d)).toBeLessThanOrEqual(blockCount(d));
        keys.add(diagramKey(c));
      }
      expect(keys.size, diagramKey(d)).toBe(coarsenings(d).length);
    }
  }
});

test("the Möbius function's closed form agrees with the recursion that defines it", () => {
  // μ(λ,λ) = 1 and Σ_{λ ≤ ν ≤ μ} μ(λ,ν) = 0 for λ < μ. The closed form — a product of
  // (−1)^{k−1}(k−1)! over the coarser partition's blocks — is a theorem, not a definition,
  // so checking it against the recursion is a real check.
  for (let n = 1; n <= 3; n++) {
    for (const d of partitions(n)) {
      expect(partitionMobius(d, d), diagramKey(d)).toBe(1);
      for (const c of coarsenings(d)) {
        if (diagramKey(c) === diagramKey(d)) continue;
        // Sum the closed form over the whole interval [d, c]; it must vanish.
        const total = coarsenings(d)
          .filter((middle) => refines(middle, c))
          .reduce((sum, middle) => sum + (partitionMobius(d, middle) as number), 0);
        expect(total, `${diagramKey(d)} → ${diagramKey(c)}`).toBe(0);
      }
    }
  }
  expect(partitionMobius(partitions(1)[1] as Diagram, partitions(1)[0] as Diagram)).toBeDefined();
});

test("the two bases invert each other", () => {
  for (let n = 1; n <= 3; n++) {
    for (const d of partitions(n)) {
      same(orbitToDiagram(diagramToOrbit(basisElement(d))), basisElement(d));
      same(diagramToOrbit(orbitToDiagram(basisElement(d))), basisElement(d));
    }
  }
});

test("the change of basis is unitriangular in the number of blocks", () => {
  // Each expansion keeps its own diagram with coefficient 1 and only reaches COARSER ones,
  // which is what makes the two maps inverse at all.
  for (let n = 1; n <= 3; n++) {
    for (const d of partitions(n)) {
      for (const expansion of [diagramToOrbit(basisElement(d)), orbitToDiagram(basisElement(d))]) {
        const self = expansion.get(diagramKey(d));
        expect(self?.coefficient, diagramKey(d)).toBe(1);
        for (const { diagram: target } of expansion.values()) {
          expect(refines(d, target), diagramKey(d)).toBe(true);
          expect(blockCount(target), diagramKey(d)).toBeLessThanOrEqual(blockCount(d));
        }
      }
    }
  }
});

test("the finest and coarsest partitions are the extreme cases", () => {
  const n = 2;
  const all = partitions(n);
  const finest = all.find((d) => blockCount(d) === 2 * n) as Diagram;
  const coarsest = all.find((d) => blockCount(d) === 1) as Diagram;
  // d at the finest partition expands over every partition of 2n points: Bell(2n) terms.
  expect(diagramToOrbit(basisElement(finest)).size).toBe(bell(2 * n));
  // The coarsest has nothing above it, so the two bases agree there.
  same(diagramToOrbit(basisElement(coarsest)), basisElement(coarsest));
  same(orbitToDiagram(basisElement(coarsest)), basisElement(coarsest));
  // μ over the whole lattice of 4 points is (−1)^3·3! = −6.
  expect(partitionMobius(finest, coarsest)).toBe(-6);
});

test("the product is a polynomial in the loop parameter, and it is bilinear", () => {
  const n = 2;
  const all = partitions(n);
  const a = basisElement(all[0] as Diagram);
  const b = basisElement(all[3] as Diagram);
  const c = basisElement(all[5] as Diagram);
  const degrees = diagramProduct(a, b);
  expect([...degrees.keys()].every((k) => k >= 0)).toBe(true);
  // (a + c)·b = a·b + c·b, degree by degree.
  const sum = element([
    [all[0] as Diagram, 1],
    [all[5] as Diagram, 1],
  ]);
  const combined = diagramProduct(sum, b);
  const separate = new Map(diagramProduct(a, b));
  for (const [degree, part] of diagramProduct(c, b)) {
    const existing = separate.get(degree);
    separate.set(
      degree,
      existing === undefined
        ? part
        : element([
            ...[...existing.values()].map((v) => [v.diagram, v.coefficient] as const),
            ...[...part.values()].map((v) => [v.diagram, v.coefficient] as const),
          ]),
    );
  }
  const byDegree = (a: number, b: number): number => a - b;
  expect([...combined.keys()].sort(byDegree)).toEqual([...separate.keys()].sort(byDegree));
  for (const [degree, part] of combined) same(part, separate.get(degree) as AlgebraElement);
});

test("mismatched or unrelated partitions have no Möbius value", () => {
  const two = partitions(2);
  const finest = two.find((d) => blockCount(d) === 4) as Diagram;
  const coarsest = two.find((d) => blockCount(d) === 1) as Diagram;
  expect(partitionMobius(coarsest, finest)).toBeUndefined(); // the wrong way round
  expect(refines(coarsest, finest)).toBe(false);
  expect(refines(finest, coarsest)).toBe(true);
  expect(coarsenings(coarsest).length).toBe(1);
});
