import { expect, test } from "vite-plus/test";
import {
  CLASS_ADMITS,
  composeDiagrams,
  diagram,
  type DiagramClass,
  diagramKey,
  enumerateDiagrams,
  identityDiagram,
  isPlanar,
} from "../src/diagram.ts";
import { bell, catalan, dimensionOf, motzkin } from "../src/dimensions.ts";

const CLASSES: DiagramClass[] = [
  "partition",
  "planar-partition",
  "brauer",
  "temperley-lieb",
  "motzkin",
  "rook",
  "symmetric",
];

test("every class's enumeration matches its closed-form dimension", () => {
  // The closed forms are derived from the combinatorics, the enumeration from brute
  // force over all set partitions of 2n points — so agreeing is a real check on both.
  for (const cls of CLASSES) {
    for (let n = 1; n <= 3; n++) {
      expect(enumerateDiagrams(cls, n).length, `${cls} n=${n}`).toBe(dimensionOf(cls, n));
    }
  }
});

test("the dimensions ARE the counting sequences", () => {
  expect([1, 2, 3].map((n) => dimensionOf("partition", n))).toEqual([2, 15, 203]); // Bell(2n)
  expect([1, 2, 3, 4].map(bell)).toEqual([1, 2, 5, 15]);
  expect([1, 2, 3].map((n) => dimensionOf("temperley-lieb", n))).toEqual([1, 2, 5]); // Catalan
  expect([1, 2, 3, 4].map(catalan)).toEqual([1, 2, 5, 14]);
  expect([1, 2, 3].map((n) => dimensionOf("planar-partition", n))).toEqual([2, 14, 132]); // Catalan(2n)
  expect([1, 2, 3].map((n) => dimensionOf("brauer", n))).toEqual([1, 3, 15]); // (2n−1)!!
  expect([1, 2, 3].map((n) => dimensionOf("motzkin", n))).toEqual([2, 9, 51]); // Motzkin(2n)
  expect([2, 4, 6].map(motzkin)).toEqual([2, 9, 51]);
  expect([1, 2, 3].map((n) => dimensionOf("rook", n))).toEqual([2, 7, 34]);
  expect([1, 2, 3].map((n) => dimensionOf("symmetric", n))).toEqual([1, 2, 6]);
});

test("each class is closed under the product, with the identity in it", () => {
  for (const cls of CLASSES) {
    for (const n of [2, 3]) {
      const basis = enumerateDiagrams(cls, n);
      const keys = new Set(basis.map(diagramKey));
      const id = identityDiagram(n);
      expect(CLASS_ADMITS[cls](id), `${cls} identity`).toBe(true);
      for (const a of basis) {
        const viaIdentity = composeDiagrams(id, a);
        expect(diagramKey(viaIdentity.result)).toBe(diagramKey(a));
        expect(viaIdentity.loops).toBe(0);
        for (const b of basis) {
          expect(keys.has(diagramKey(composeDiagrams(a, b).result)), `${cls} closure`).toBe(true);
        }
      }
    }
  }
});

test("the product is associative, loop counts included", () => {
  // δ-powers have to agree too: (ab)c and a(bc) must close the same number of loops,
  // or the algebra would not be associative over ℤ[δ].
  for (const cls of CLASSES) {
    const basis = enumerateDiagrams(cls, 3).slice(0, 14);
    for (const a of basis) {
      for (const b of basis) {
        const ab = composeDiagrams(a, b);
        for (const c of basis) {
          const left = composeDiagrams(ab.result, c);
          const bc = composeDiagrams(b, c);
          const right = composeDiagrams(a, bc.result);
          expect(diagramKey(left.result)).toBe(diagramKey(right.result));
          expect(ab.loops + left.loops).toBe(bc.loops + right.loops);
        }
      }
    }
  }
});

// ── the defining relations ──────────────────────────────────────────────────────

/** The Temperley–Lieb / Brauer generator eᵢ: a cup at i,i+1 over a cap, rest through. */
const e = (n: number, i: number) =>
  diagram(n, [
    [i, i + 1],
    [-i, -(i + 1)],
    ...Array.from({ length: n }, (_, k) => k + 1)
      .filter((k) => k !== i && k !== i + 1)
      .map((k) => [k, -k]),
  ]);

/** The symmetric-group generator sᵢ: strands i and i+1 cross. */
const s = (n: number, i: number) =>
  diagram(n, [
    [i, -(i + 1)],
    [i + 1, -i],
    ...Array.from({ length: n }, (_, k) => k + 1)
      .filter((k) => k !== i && k !== i + 1)
      .map((k) => [k, -k]),
  ]);

test("Temperley–Lieb: eᵢ² = δeᵢ, eᵢeᵢ₊₁eᵢ = eᵢ, and distant generators commute", () => {
  const n = 4;
  for (let i = 1; i < n; i++) {
    const square = composeDiagrams(e(n, i), e(n, i));
    expect(diagramKey(square.result), `e_${i}² diagram`).toBe(diagramKey(e(n, i)));
    expect(square.loops, `e_${i}² closes one loop`).toBe(1); // the δ
  }
  for (let i = 1; i < n - 1; i++) {
    const left = composeDiagrams(composeDiagrams(e(n, i), e(n, i + 1)).result, e(n, i));
    expect(diagramKey(left.result), `e_${i}e_${i + 1}e_${i}`).toBe(diagramKey(e(n, i)));
    expect(left.loops).toBe(0);
    const other = composeDiagrams(composeDiagrams(e(n, i + 1), e(n, i)).result, e(n, i + 1));
    expect(diagramKey(other.result)).toBe(diagramKey(e(n, i + 1)));
  }
  // |i − j| ≥ 2: the generators are disjoint, so they commute.
  const ac = composeDiagrams(e(4, 1), e(4, 3));
  const ca = composeDiagrams(e(4, 3), e(4, 1));
  expect(diagramKey(ac.result)).toBe(diagramKey(ca.result));
  expect(ac.loops).toBe(0);
});

test("Brauer: sᵢ² = 1, the braid relation, and sᵢeᵢ = eᵢ", () => {
  const n = 4;
  for (let i = 1; i < n; i++) {
    expect(diagramKey(composeDiagrams(s(n, i), s(n, i)).result)).toBe(diagramKey(identityDiagram(n)));
    expect(diagramKey(composeDiagrams(s(n, i), e(n, i)).result)).toBe(diagramKey(e(n, i)));
    expect(diagramKey(composeDiagrams(e(n, i), s(n, i)).result)).toBe(diagramKey(e(n, i)));
  }
  // Braid: s₁s₂s₁ = s₂s₁s₂.
  const left = composeDiagrams(composeDiagrams(s(n, 1), s(n, 2)).result, s(n, 1));
  const right = composeDiagrams(composeDiagrams(s(n, 2), s(n, 1)).result, s(n, 2));
  expect(diagramKey(left.result)).toBe(diagramKey(right.result));
});

test("the inclusions hold: TL ⊂ Brauer ⊂ partition, symmetric ⊂ rook", () => {
  const n = 3;
  const inside = (cls: DiagramClass) => new Set(enumerateDiagrams(cls, n).map(diagramKey));
  const tl = inside("temperley-lieb");
  const brauer = inside("brauer");
  const partition = inside("partition");
  const symmetric = inside("symmetric");
  const rook = inside("rook");
  for (const key of tl) expect(brauer.has(key)).toBe(true);
  for (const key of brauer) expect(partition.has(key)).toBe(true);
  for (const key of symmetric) expect(rook.has(key)).toBe(true);
  for (const key of rook) expect(partition.has(key)).toBe(true);
  expect(tl.size).toBeLessThan(brauer.size); // proper, not equal
  expect(brauer.size).toBeLessThan(partition.size);
});

test("planarity is the cyclic non-crossing condition", () => {
  // s₁ on two strands crosses; e₁ does not. Around the circle the bottom row runs
  // right to left, so {1,−1},{2,−2} is planar while {1,−2},{2,−1} is not.
  expect(isPlanar(e(2, 1))).toBe(true);
  expect(isPlanar(identityDiagram(2))).toBe(true);
  expect(isPlanar(s(2, 1))).toBe(false);
  // A three-element block may still be planar.
  expect(isPlanar(diagram(2, [[1, 2, -2], [-1]]))).toBe(true);
  expect(
    isPlanar(
      diagram(2, [
        [1, -2],
        [2, -1],
      ]),
    ),
  ).toBe(false);
});
