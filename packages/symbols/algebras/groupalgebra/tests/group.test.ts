import { expect, test } from "vite-plus/test";
import {
  basisElement,
  classSum,
  combine,
  conjugacyClasses,
  cyclicGroup,
  dihedralGroup,
  directProduct,
  type Element,
  type Group,
  identityIndex,
  inverse,
  isAbelian,
  isCentral,
  multiplyElements,
  order,
} from "../src/group.ts";

const show = (e: Element) => [...e].sort(([a], [b]) => a - b);
const groups = (): Group[] => [
  cyclicGroup(1)!,
  cyclicGroup(5)!,
  cyclicGroup(6)!,
  dihedralGroup(3)!,
  dihedralGroup(4)!,
  dihedralGroup(5)!,
  directProduct(cyclicGroup(2)!, cyclicGroup(3)!)!,
];

test("the multiplication tables really are groups", () => {
  // Associativity, an identity, and inverses — checked rather than assumed, because
  // everything downstream rests on it.
  for (const g of groups()) {
    const n = order(g);
    expect(identityIndex(g), `${g.name} identity`).toBe(0);
    for (let i = 0; i < n; i++) {
      expect(inverse(g, i), `${g.name} inverse of ${i}`).toBeDefined();
      for (let j = 0; j < n; j++) {
        for (let k = 0; k < n; k++) {
          expect(g.multiply(g.multiply(i, j), k), `${g.name} associativity`).toBe(
            g.multiply(i, g.multiply(j, k)),
          );
        }
      }
    }
    // Every row of the table is a permutation — the Latin square property.
    for (let i = 0; i < n; i++) {
      const row = new Set(Array.from({ length: n }, (_, j) => g.multiply(i, j)));
      expect(row.size, `${g.name} row ${i}`).toBe(n);
    }
  }
});

test("orders are as advertised", () => {
  for (const n of [1, 2, 5, 6, 12]) expect(order(cyclicGroup(n)!)).toBe(n);
  for (const n of [1, 3, 4, 5, 6]) expect(order(dihedralGroup(n)!)).toBe(2 * n);
  expect(order(directProduct(cyclicGroup(2)!, cyclicGroup(3)!)!)).toBe(6);
});

test("cyclic groups are abelian, dihedral ones (past n = 2) are not", () => {
  for (const n of [1, 2, 5, 6]) expect(isAbelian(cyclicGroup(n)!), `Z_${n}`).toBe(true);
  expect(isAbelian(directProduct(cyclicGroup(2)!, cyclicGroup(3)!)!)).toBe(true);
  for (const n of [3, 4, 5]) expect(isAbelian(dihedralGroup(n)!), `D_${n}`).toBe(false);
  expect(isAbelian(dihedralGroup(1)!)).toBe(true); // order 2
  expect(isAbelian(dihedralGroup(2)!)).toBe(true); // the Klein four-group
});

test("the number of conjugacy classes matches the closed forms", () => {
  // Abelian: every element is its own class.
  for (const n of [1, 5, 6, 12]) {
    expect(conjugacyClasses(cyclicGroup(n)!).length, `Z_${n}`).toBe(n);
  }
  // D_n has (n+3)/2 classes for odd n, (n+6)/2 for even n.
  for (const n of [3, 5, 7]) {
    expect(conjugacyClasses(dihedralGroup(n)!).length, `D_${n} odd`).toBe((n + 3) / 2);
  }
  for (const n of [4, 6, 8]) {
    expect(conjugacyClasses(dihedralGroup(n)!).length, `D_${n} even`).toBe((n + 6) / 2);
  }
  // D_3 is S_3: three classes (identity, transpositions, 3-cycles).
  expect(conjugacyClasses(dihedralGroup(3)!).length).toBe(3);
});

test("the classes partition the group", () => {
  for (const g of groups()) {
    const classes = conjugacyClasses(g);
    const flat = classes.flat();
    expect(new Set(flat).size, `${g.name} disjoint`).toBe(flat.length);
    expect(flat.length, `${g.name} covers`).toBe(order(g));
    // The identity is always alone in its class.
    expect(classes.find((c) => c.includes(0))).toEqual([0]);
  }
});

test("k[G] is commutative exactly when G is abelian", () => {
  for (const g of groups()) {
    const commutes = g.elements.every((_, i) =>
      g.elements.every(
        (__, j) =>
          JSON.stringify(show(multiplyElements(g, basisElement(i), basisElement(j)))) ===
          JSON.stringify(show(multiplyElements(g, basisElement(j), basisElement(i)))),
      ),
    );
    expect(commutes, `${g.name}`).toBe(isAbelian(g));
  }
});

test("class sums are central, and single elements usually are not", () => {
  // The payoff: a non-commutative algebra with a canonical commutative subalgebra.
  for (const g of groups()) {
    for (const members of conjugacyClasses(g)) {
      expect(isCentral(g, classSum(members)), `${g.name} class sum`).toBe(true);
    }
  }
  // In D_3 a single reflection is not central.
  const d3 = dihedralGroup(3)!;
  const reflection = d3.elements.indexOf("s0");
  expect(isCentral(d3, basisElement(reflection))).toBe(false);
  // But in an abelian group every basis element is.
  const z5 = cyclicGroup(5)!;
  expect(z5.elements.every((_, i) => isCentral(z5, basisElement(i)))).toBe(true);
});

test("the centre's dimension is the number of conjugacy classes", () => {
  // Class sums are linearly independent — they have disjoint supports — so they are a
  // basis of the centre, and counting them counts its dimension.
  for (const g of groups()) {
    const classes = conjugacyClasses(g);
    const supports = classes.map((c) => new Set(c));
    for (let i = 0; i < supports.length; i++) {
      for (let j = i + 1; j < supports.length; j++) {
        expect(
          [...supports[i]!].some((x) => supports[j]!.has(x)),
          `${g.name}`,
        ).toBe(false);
      }
    }
    expect(classes.length).toBeLessThanOrEqual(order(g));
  }
});

test("k[Z_n] multiplies by adding indices mod n — it is k[x]/(x^n − 1)", () => {
  const n = 6;
  const g = cyclicGroup(n)!;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      expect(show(multiplyElements(g, basisElement(i), basisElement(j)))).toEqual([
        [(i + j) % n, 1],
      ]);
    }
  }
  // (1 + x)(1 + x^5) in k[Z_6] = 1 + x + x^5 + x^0 = 2 + x + x^5.
  const onePlusX = combine([
    [basisElement(0), 1],
    [basisElement(1), 1],
  ]);
  const onePlusX5 = combine([
    [basisElement(0), 1],
    [basisElement(5), 1],
  ]);
  expect(show(multiplyElements(g, onePlusX, onePlusX5))).toEqual([
    [0, 2],
    [1, 1],
    [5, 1],
  ]);
});

test("the group algebra's product is associative", () => {
  for (const g of [cyclicGroup(5)!, dihedralGroup(4)!]) {
    const sample = g.elements.map((_, i) => basisElement(i));
    for (const a of sample) {
      for (const b of sample) {
        for (const c of sample.slice(0, 4)) {
          expect(
            show(multiplyElements(g, multiplyElements(g, a, b), c)),
            `${g.name} associativity`,
          ).toEqual(show(multiplyElements(g, a, multiplyElements(g, b, c))));
        }
      }
    }
  }
});

test("degenerate and out-of-range groups yield nothing", () => {
  expect(cyclicGroup(0)).toBeUndefined();
  expect(dihedralGroup(0)).toBeUndefined();
  expect(cyclicGroup(-3)).toBeUndefined();
});
