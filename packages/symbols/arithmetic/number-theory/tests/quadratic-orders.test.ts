import { describe, expect, it } from "vite-plus/test";
import { elementText, ringText } from "../src/quadratic-lattice.ts";
import {
  classGroup,
  classify,
  divideExact,
  factorElement,
  fundamentalUnit,
  irreducibleFactorizations,
  mul,
  norm,
  type QuadraticElement,
  quadraticOrder,
  quadraticRing,
  rootsOfUnity,
} from "../src/quadratic.ts";
import sage from "./quadratic-orders.sage.json" with { type: "json" };

// tests/quadratic-orders.sage.json (scripts/collect-quadratic-orders-sage.py): for non-maximal
// orders, PARI's class number and fundamental unit, and, for imaginary ones, each small element's
// kind found by brute force over O/(α) and over products in a box.

const cells = (): QuadraticElement[] => {
  const [lo, hi] = sage.grid as [number, number];
  const out: QuadraticElement[] = [];
  for (let x = lo; x <= hi; x++) for (let y = lo; y <= hi; y++) out.push([BigInt(x), BigInt(y)]);
  return out;
};

describe("quadratic orders", () => {
  it("are named by discriminant: conductor, s and r from the field's", () => {
    const R = quadraticOrder(-12n)!;
    expect([R.d, R.conductor, R.s, R.r]).toEqual([-3n, 2n, -2n, -4n]);
    expect(ringText(R)).toBe("ℤ[√−3]");
    expect(ringText(quadraticOrder(32n)!)).toBe("ℤ[√8]");
    expect(elementText(quadraticOrder(32n)!, [3n, 1n])).toBe("3 + √8");
    // O_K is the order of the field's own discriminant.
    expect(quadraticOrder(-3n)).toBe(quadraticRing(-3n));
    expect(quadraticOrder(-4n)!.conductor).toBe(1n);
    for (const D of [0n, 2n, -5n, 16n]) expect(quadraticOrder(D)).toBeUndefined();
  });

  it("have PARI's class numbers and fundamental units", () => {
    for (const o of sage.orders) {
      const R = quadraticOrder(BigInt(o.D))!;
      expect([o.D, R.conductor]).toEqual([o.D, BigInt(o.f)]);
      expect([o.D, classGroup(R)!.order]).toEqual([o.D, o.h]);
      if (o.unit) expect([o.D, fundamentalUnit(R)!.map(Number)]).toEqual([o.D, o.unit]);
    }
  });

  it("classify each small element as brute force over O/(α) and its products does", () => {
    for (const o of sage.orders.filter((o) => o.D < 0)) {
      const R = quadraticOrder(BigInt(o.D))!;
      const prime = new Set(o.prime!.split(" ").filter(Boolean));
      const irreducible = new Set(o.irreducible!.split(" ").filter(Boolean));
      for (const a of cells()) {
        const n = Number(norm(R, a));
        if (n <= 1 || n > sage.normLimit) continue;
        const key = `${a[0]},${a[1]}`;
        const want = prime.has(key) ? "prime" : irreducible.has(key) ? "irreducible" : "composite";
        expect([o.D, key, classify(R, a)]).toEqual([o.D, key, want]);
      }
    }
  });

  it("show ℤ[√−3]'s two factorizations of 4, and that it has only ±1 for units", () => {
    const R = quadraticOrder(-12n)!;
    expect(rootsOfUnity(R)).toHaveLength(2);
    expect(factorElement(R, [4n, 0n])).toBeUndefined(); // no unique factorization
    const ways = irreducibleFactorizations(R, [4n, 0n])!;
    // 4 = 2·2 = −(−1 + √−3)(1 + √−3), each factor in normal form.
    expect(ways.map((w) => w.map((p) => elementText(R, p)))).toEqual([
      ["2", "2"],
      ["−1 + √−3", "1 + √−3"],
    ]);
    for (const way of ways) {
      const product = way.reduce((acc, p) => mul(R, acc, p), [1n, 0n] as QuadraticElement);
      expect(divideExact(R, [4n, 0n], product)).toBeDefined();
    }
  });
});
