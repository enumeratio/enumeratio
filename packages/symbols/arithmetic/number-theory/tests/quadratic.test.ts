import { describe, expect, it } from "vite-plus/test";
import { factorGaussian, isGaussianPrime } from "../src/gaussian.ts";
import {
  classGroup,
  classify,
  compose,
  divideExact,
  elementsOfNorm,
  equal,
  factorElement,
  fundamentalUnit,
  irreducibleFactorizations,
  irreducibleFactors,
  isUnit,
  mul,
  norm,
  normalize,
  ONE,
  power,
  type QuadraticElement,
  quadraticRing,
  reduceForm,
} from "../src/quadratic.ts";
import sage from "./quadratic.sage.json" with { type: "json" };

// tests/quadratic.sage.json is Sage's answer (scripts/collect-quadratic-sage.py) for every
// squarefree |d| ≤ 120: the class number, the fundamental unit, and which x + yω in a small
// grid generate prime ideals.

const ring = (d: number) => quadraticRing(BigInt(d))!;
const grid = (): QuadraticElement[] => {
  const [lo, hi] = sage.grid as [number, number];
  const cells: QuadraticElement[] = [];
  for (let x = lo; x <= hi; x++) for (let y = lo; y <= hi; y++) cells.push([BigInt(x), BigInt(y)]);
  return cells;
};

/** Irreducible by definition: no divisor of norm strictly between 1 and |N(a)|. */
function irreducibleByDefinition(d: number, a: QuadraticElement): boolean {
  const R = ring(d);
  const n = norm(R, a) < 0n ? -norm(R, a) : norm(R, a);
  for (let m = 2n; m * m <= n; m++) {
    if (n % m !== 0n) continue;
    for (const signed of d < 0 ? [m] : [m, -m]) {
      if (elementsOfNorm(R, signed)!.some((b) => divideExact(R, a, b) !== undefined)) return false;
    }
  }
  return true;
}

describe("quadratic rings", () => {
  it("reduces d to its squarefree part", () => {
    expect(quadraticRing(8n)?.d).toBe(2n);
    expect(quadraticRing(-12n)?.d).toBe(-3n);
    expect(quadraticRing(9n)).toBeUndefined();
    expect(quadraticRing(0n)).toBeUndefined();
    expect(ring(-7).discriminant).toBe(-7n);
    expect(ring(-5).discriminant).toBe(-20n);
  });

  it("matches Sage's class numbers", () => {
    for (const { d, h } of sage.fields) expect([d, classGroup(ring(d))!.order]).toEqual([d, h]);
  });

  it("matches Sage's fundamental units", () => {
    for (const { d, unit } of sage.fields) {
      if (unit === undefined) continue;
      const R = ring(d);
      const eps = fundamentalUnit(R)!;
      expect([d, eps.map(Number)]).toEqual([d, unit]);
      expect(isUnit(R, eps)).toBe(true);
    }
  });

  it("composes forms into a group", () => {
    for (const d of [-5, -14, -23, -47, -71, -199, 10, 79, 82, 226]) {
      const R = ring(d);
      const G = classGroup(R)!;
      const D = R.discriminant;
      const key = (f: readonly bigint[]) => reduceForm(D, f as never).join();
      for (const f of G.classes) {
        expect(key(compose(D, f, G.classes[0]!))).toBe(key(f));
        // (a, −b, c) is the inverse class.
        expect(key(compose(D, f, [f[0], -f[1], f[2]]))).toBe(key(G.classes[0]!));
        for (const g of G.classes) {
          for (const k of G.classes.slice(0, 4)) {
            const left = compose(D, reduceForm(D, compose(D, f, g)), k);
            const right = compose(D, f, reduceForm(D, compose(D, g, k)));
            expect(key(left)).toBe(key(right));
          }
        }
      }
    }
  });

  it("finds the prime elements Sage finds", () => {
    for (const { d, primes } of sage.fields) {
      const R = ring(d);
      const expected = new Set(primes.split(" ").filter(Boolean));
      const ours = grid().filter((a) => classify(R, a) === "prime");
      expect([d, ours.map((a) => a.join(",")).toSorted()]).toEqual([d, [...expected].toSorted()]);
    }
  });

  it("tells irreducible from composite as the definition does", () => {
    for (const { d } of sage.fields.filter(({ d }) => Math.abs(d) <= 40)) {
      const R = ring(d);
      for (const a of grid()) {
        const kind = classify(R, a);
        if (kind === "zero" || kind === "unit") continue;
        expect([d, a.join(), kind !== "composite"]).toEqual([d, a.join(), irreducibleByDefinition(d, a)]);
      }
    }
  });

  it("factors over a UFD, and the factors multiply back", () => {
    for (const { d, h } of sage.fields) {
      if (h !== 1) continue;
      const R = ring(d);
      for (const a of grid()) {
        if (norm(R, a) === 0n || isUnit(R, a)) continue;
        const factors = factorElement(R, a)!;
        const product = factors.reduce((acc, [p, e]) => mul(R, acc, power(R, p, e)), ONE);
        expect([d, a.join(), product.join()]).toEqual([d, a.join(), a.join()]);
        for (const [p] of factors.slice(isUnit(R, factors[0]![0]) ? 1 : 0)) expect(classify(R, p)).toBe("prime");
      }
    }
  });

  it("factors into irreducibles in any O_K", () => {
    for (const d of [-5, -6, -14, 10, 15]) {
      const R = ring(d);
      for (const a of grid()) {
        if (norm(R, a) === 0n || isUnit(R, a)) continue;
        const parts = irreducibleFactors(R, a)!;
        const product = parts.reduce((acc, p) => mul(R, acc, p), ONE);
        expect(isUnit(R, divideExact(R, a, product)!)).toBe(true);
        for (const p of parts) expect(classify(R, p)).toMatch(/prime|irreducible/);
      }
    }
    // 6 = 2·3 = (1 + √−5)(1 − √−5): every factor irreducible, none prime.
    const R = ring(-5);
    expect(classify(R, [2n, 0n])).toBe("irreducible");
    expect(classify(R, [1n, 1n])).toBe("irreducible");
    expect(classify(R, [6n, 0n])).toBe("composite");
    const ways = irreducibleFactorizations(R, [6n, 0n])!.map((parts) => parts.map((p) => p.join()).toSorted());
    expect(ways.toSorted((a, b) => a.join().localeCompare(b.join()))).toEqual([
      ["-1,1", "1,1"],
      ["2,0", "3,0"],
    ]);
  });

  it("finds every irreducible factorization, each multiplying back to a unit multiple", () => {
    for (const d of [-5, -14, -23, 10]) {
      const R = ring(d);
      for (const a of grid()) {
        if (norm(R, a) === 0n || isUnit(R, a)) continue;
        for (const parts of irreducibleFactorizations(R, a)!) {
          const product = parts.reduce((acc, p) => mul(R, acc, p), ONE);
          expect(isUnit(R, divideExact(R, a, product)!)).toBe(true);
          for (const p of parts) expect(classify(R, p)).toMatch(/prime|irreducible/);
        }
      }
    }
  });

  it("agrees with the Gaussian kernel at d = −1", () => {
    const R = ring(-1);
    for (const a of grid()) {
      if (norm(R, a) === 0n || isUnit(R, a)) continue;
      expect(classify(R, a) === "prime").toBe(isGaussianPrime(a));
      const ours = factorElement(R, a)!
        .map(([p, e]) => `${p.join()}^${e}`)
        .toSorted();
      const gaussian = factorGaussian(a)!
        .map(([p, e]) => `${p.join()}^${e}`)
        .toSorted();
      expect(ours).toEqual(gaussian);
    }
  });

  it("normalizes associates to one representative", () => {
    for (const d of [-1, -3, -7, 2, 5, 13]) {
      const R = ring(d);
      const units = d < 0 ? [ONE] : [ONE, fundamentalUnit(R)!, mul(R, fundamentalUnit(R)!, fundamentalUnit(R)!)];
      for (const a of grid().slice(0, 60)) {
        if (norm(R, a) === 0n) continue;
        const [w] = normalize(R, a);
        for (const u of units) {
          for (const sign of [1n, -1n]) {
            const b = mul(R, a, [sign * u[0], sign * u[1]]);
            expect(equal(normalize(R, b)[0], w)).toBe(true);
          }
        }
      }
    }
  });
});
