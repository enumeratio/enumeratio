import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);

/** Numerically substitute an integer for a symbol and evaluate, for cross-checking a
 * symbolic closed form against direct evaluation at several concrete values. */
function at(expr: unknown, subs: Record<string, number>): number {
  return ce
    .box(expr as never)
    .subs(subs)
    .evaluate().re!;
}

// i^m, m free of the index: a factorial power, Product(i^m, i=1..n) = Factorial(n)^m.
test("Product(i^2, i=1..n) matches the direct product at several n", () => {
  const symbolic = ["Product", ["Power", "i", 2], ["Tuple", "i", 1, "n"]];
  for (const n of [1, 2, 5, 7]) {
    let direct = 1;
    for (let i = 1; i <= n; i++) direct *= i * i;
    expect(at(symbolic, { n }), `n=${n}`).toEqual(direct);
  }
});
test("Product(i^3, i=1..n) closes for a different constant exponent too", () => {
  const symbolic = ["Product", ["Power", "i", 3], ["Tuple", "i", 1, "n"]];
  for (const n of [1, 3, 6]) {
    let direct = 1;
    for (let i = 1; i <= n; i++) direct *= i ** 3;
    expect(at(symbolic, { n }), `n=${n}`).toEqual(direct);
  }
});

// c^{f(i)}, c free of the index: Product(c^{f(i)}, i=lo..hi) = c^{sum f(i)}.
test("Product(x^k, k=1..n) matches the direct product at several n and x", () => {
  const symbolic = ["Product", ["Power", "x", "k"], ["Tuple", "k", 1, "n"]];
  for (const n of [1, 2, 5]) {
    for (const x of [2, 3, 0.5]) {
      let direct = 1;
      for (let k = 1; k <= n; k++) direct *= x ** k;
      expect(at(symbolic, { n, x }), `n=${n} x=${x}`).toBeCloseTo(direct, 9);
    }
  }
});
test("Product(2^k, k=1..n) also closes -- a numeric base still counts as 'free of the index'", () => {
  const symbolic = ["Product", ["Power", 2, "k"], ["Tuple", "k", 1, "n"]];
  for (const n of [1, 4, 6]) {
    let direct = 1;
    for (let k = 1; k <= n; k++) direct *= 2 ** k;
    expect(at(symbolic, { n }), `n=${n}`).toEqual(direct);
  }
});

// Nested products (more than one Tuple clause) fold inner-first.
test("A triangular product with a concrete outer bound matches direct nested loops", () => {
  for (const p of [1, 2, 4, 5]) {
    let direct = 1;
    for (let i = 1; i <= p; i++) for (let j = 1; j <= i; j++) direct *= i + j;
    expect(at(["Product", ["Add", "i", "j"], ["Tuple", "i", 1, p], ["Tuple", "j", 1, "i"]], {})).toEqual(direct);
  }
});
test("The symbolic triangular product matches the direct nested product at several p", () => {
  const symbolic = ["Product", ["Power", 2, ["Add", "i", "j"]], ["Tuple", "i", 1, "p"], ["Tuple", "j", 1, "i"]];
  for (const p of [1, 2, 3, 5]) {
    let direct = 1;
    for (let i = 1; i <= p; i++) for (let j = 1; j <= i; j++) direct *= 2 ** (i + j);
    expect(at(symbolic, { p }), `p=${p}`).toEqual(direct);
  }
});
