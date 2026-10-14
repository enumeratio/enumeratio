import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareGroupAlgebra } from "../src/declare.ts";
import { alternatingIndex, cyclicIndex, dihedralIndex, listedIndex, symmetricIndex } from "../src/cycle-index.ts";
import { permutationGroupClosure } from "../src/permutations.ts";

const ce = bareEngine();
declareGroupAlgebra(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const L = (...xs: Expr[]): Expr => ["List", ...xs];
const cycleIndex = (group: Expr, ...vars: string[]) =>
  ce.box(["CycleIndexPolynomial", group, L(...vars)] as never).evaluate();
const frac = (n: number, d: number, ...factors: Expr[]): Expr => ["Multiply", ["Rational", n, d], ...factors];
const pow = (x: string, n: number): Expr => ["Power", x, n];

// Every expected value below was checked against a Wolfram kernel (x_i marks the i-cycles).
test("cyclic, dihedral and alternating groups, Wolfram's variable convention", () => {
  const expected = (group: Expr, vars: string[], poly: Expr) =>
    expect(cycleIndex(group, ...vars).isSame(ce.box(poly as never).evaluate())).toBe(true);
  expected(
    ["CyclicGroup", 4],
    ["a", "b", "c", "d"],
    ["Add", frac(1, 4, pow("a", 4)), frac(1, 4, pow("b", 2)), frac(1, 2, "d")],
  );
  expected(
    ["DihedralGroup", 4],
    ["a", "b", "c", "d"],
    ["Add", frac(1, 8, pow("a", 4)), frac(1, 4, pow("a", 2), "b"), frac(3, 8, pow("b", 2)), frac(1, 4, "d")],
  );
  expected(
    ["DihedralGroup", 3],
    ["a", "b", "c"],
    ["Add", frac(1, 6, pow("a", 3)), frac(1, 2, "a", "b"), frac(1, 3, "c")],
  );
  expected(
    ["AlternatingGroup", 4],
    ["a", "b", "c", "d"],
    ["Add", frac(1, 12, pow("a", 4)), frac(1, 4, pow("b", 2)), frac(2, 3, "a", "c")],
  );
  // The degenerate dihedral groups: D_1 swaps two points, D_2 is the Klein four-group on four.
  expected(["DihedralGroup", 1], ["a", "b"], ["Add", frac(1, 2, pow("a", 2)), frac(1, 2, "b")]);
  expected(
    ["DihedralGroup", 2],
    ["a", "b", "c", "d"],
    ["Add", frac(1, 4, pow("a", 4)), frac(1, 2, pow("a", 2), "b"), frac(1, 4, pow("b", 2))],
  );
  expected(
    ["PermutationGroup", L(["Cycles", L(L(1, 2))])],
    ["a", "b"],
    ["Add", frac(1, 2, pow("a", 2)), frac(1, 2, "b")],
  );
});

test("a variable list shorter than the degree is left alone, a longer one is fine", () => {
  expect(cycleIndex(["CyclicGroup", 4], "a", "b", "c").operator).toBe("CycleIndexPolynomial");
  expect(
    cycleIndex(["CyclicGroup", 4], "a", "b", "c", "d", "e").isSame(cycleIndex(["CyclicGroup", 4], "a", "b", "c", "d")),
  ).toBe(true);
});

test("the closed forms agree with the groups listed element by element", () => {
  const sorted = (index: NonNullable<ReturnType<typeof cyclicIndex>>) =>
    [...index.types.entries()].toSorted(([a], [b]) => (a < b ? -1 : 1));
  const same = (a: ReturnType<typeof cyclicIndex>, b: ReturnType<typeof cyclicIndex>) => {
    expect(a!.order).toBe(b!.order);
    expect(sorted(a!)).toEqual(sorted(b!));
  };
  const rotation = (n: number) => Array.from({ length: n }, (_, i) => ((i + 1) % n) + 1);
  const flip = (n: number) => Array.from({ length: n }, (_, i) => ((n - i) % n) + 1);
  for (let n = 3; n <= 9; n++) {
    const generators = [rotation(n), flip(n)];
    same(dihedralIndex(n), listedIndex(permutationGroupClosure(generators, n)!, n));
    same(cyclicIndex(n), listedIndex(permutationGroupClosure([rotation(n)], n)!, n));
  }
  for (let n = 1; n <= 6; n++) {
    const all = permutationGroupClosure(
      [rotation(n), n > 1 ? [2, 1, ...Array.from({ length: n - 2 }, (_, i) => i + 3)] : [1]],
      n,
    )!;
    same(symmetricIndex(n), listedIndex(all, n));
    const even = all.filter((word) => {
      const seen = new Set<number>();
      let cycles = 0;
      for (let s = 1; s <= n; s++) {
        if (seen.has(s)) continue;
        cycles++;
        for (let at = s; !seen.has(at); at = word[at - 1]!) seen.add(at);
      }
      return (n - cycles) % 2 === 0;
    });
    same(alternatingIndex(n), listedIndex(even, n));
  }
});

test("Pólya: the cycle index at x_i = k counts necklaces (C_n) and bracelets (D_n)", () => {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const necklaces = (n: number, k: number): number => {
    let sum = 0;
    for (let d = 1; d <= n; d++)
      if (n % d === 0)
        sum += Array.from({ length: d }, (_, i) => i + 1).filter((i) => gcd(i, d) === 1).length * k ** (n / d);
    return sum / n;
  };
  const bracelets = (n: number, k: number): number =>
    (necklaces(n, k) + (n % 2 === 1 ? k ** ((n + 1) / 2) : (k ** (n / 2 + 1) + k ** (n / 2)) / 2)) / 2;
  const at = (group: Expr, n: number, k: number) =>
    ce.box(["CycleIndexPolynomial", group, L(...Array<Expr>(n).fill(k))] as never).evaluate().re;
  for (let n = 3; n <= 10; n++)
    for (let k = 1; k <= 4; k++) {
      expect([n, k, at(["CyclicGroup", n], n, k)]).toEqual([n, k, necklaces(n, k)]);
      expect([n, k, at(["DihedralGroup", n], n, k)]).toEqual([n, k, bracelets(n, k)]);
    }
});

test("S_n sums to its order, and large n stay exact", () => {
  const big = symmetricIndex(30)!;
  expect(big.order).toBe(265252859812191058636308480000000n);
  expect([...big.types.values()].reduce((sum, { count }) => sum + count, 0n)).toBe(big.order);
});
