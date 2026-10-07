import { describe, expect, it } from "vite-plus/test";
import { type QuadraticLattice, quadraticLattice } from "../src/quadratic-lattice.ts";
import { classify, quadraticOrder, quadraticRing } from "../src/quadratic.ts";

/** What the layer says (i, j) is, in the kernel's words: `prime`, `irreducible`, …, or undefined. */
function kindOf(layer: QuadraticLattice, i: number, j: number): string | undefined {
  layer.prepare(i, j);
  if (layer.has(i, j, "Unknown")) return undefined;
  if (layer.has(i, j, "IsZero")) return "zero";
  if (layer.has(i, j, "IsUnit")) return "unit";
  if (layer.has(i, j, "IsPrime")) return "prime";
  if (layer.has(i, j, "IsIrreducible")) return "irreducible";
  return "composite";
}

describe("quadratic lattice layer", () => {
  it("classifies on doubles as the bigint kernel does", () => {
    for (const d of [-1, -3, -5, -14, -23, 2, 10, 79, 82]) {
      const layer = quadraticLattice(d)!;
      const R = quadraticRing(BigInt(d))!;
      // A window near the origin, and one far out where norms pass 2³².
      for (const [ci, cj] of [
        [0, 0],
        [40_000, -31_000],
      ]) {
        for (let i = ci - 6; i <= ci + 6; i++) {
          for (let j = cj - 6; j <= cj + 6; j++) {
            const exact = classify(R, [BigInt(i), BigInt(j)]);
            expect([d, i, j, kindOf(layer, i, j)]).toEqual([d, i, j, exact]);
          }
        }
      }
    }
  });

  it("describes a non-UFD's non-unique factorization", () => {
    const layer = quadraticLattice(-5)!;
    const rows = Object.fromEntries(layer.describe(6, 0).rows);
    expect(rows.kind).toBe("composite");
    expect(rows.ideals).toBe("(2, 1 + √−5)² (3, −1 + √−5) (3, 1 + √−5)");
    expect(layer.describe(1, 1).title).toBe("1 + √−5");
    expect(quadraticLattice(-3)!.describe(1, 1).title).toBe("(1 + √−3)/2");
  });
});

describe("quadratic lattice properties, for a figure's queries", () => {
  it("say what the kernel says, prime by prime", () => {
    for (const d of [-1, -5, 10]) {
      const layer = quadraticLattice(d)!;
      const R = quadraticRing(BigInt(d))!;
      for (let i = -5; i <= 5; i++) {
        for (let j = -5; j <= 5; j++) {
          layer.prepare(i, j);
          const kind = classify(R, [BigInt(i), BigInt(j)]);
          expect([d, i, j, layer.has(i, j, "IsPrime")]).toEqual([d, i, j, kind === "prime"]);
          expect(layer.has(i, j, "IsIrreducible")).toBe(kind === "prime" || kind === "irreducible");
          const splitting = ["Splits", "Inert", "Ramified"].filter((p) => layer.has(i, j, p));
          expect(splitting.length).toBe(kind === "prime" ? 1 : 0);
        }
      }
    }
  });

  it("relate points to a selection", () => {
    const gaussian = quadraticLattice(-1)!;
    const associates = [
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ];
    for (const [i, j] of associates) expect(gaussian.relatedTo("Associates", [1, 1], i!, j!)).toBe(true);
    expect(gaussian.relatedTo("Associates", [1, 1], 2, 0)).toBe(false);
    gaussian.prepare(1, 1);
    expect(gaussian.relatedTo("IrreducibleFactors", [2, 0], 1, 1)).toBe(true);
    expect(gaussian.relatedTo("Multiples", [1, 1], 2, 0)).toBe(true);
  });
});

describe("an order's lattice", () => {
  it("classifies on doubles as the exact kernel does, at the conductor's primes included", () => {
    for (const D of [-12, -36, -63, 20, 32, 72]) {
      const layer = quadraticLattice(0, { discriminant: D })!;
      const R = quadraticOrder(BigInt(D))!;
      for (let i = -8; i <= 8; i++) {
        for (let j = -8; j <= 8; j++) {
          expect([D, i, j, kindOf(layer, i, j)]).toEqual([D, i, j, classify(R, [BigInt(i), BigInt(j)])]);
        }
      }
    }
  });

  it("is titled by its ring, and says its conductor", () => {
    const layer = quadraticLattice(0, { discriminant: -12 })!;
    expect(layer.title).toBe("ℤ[√−3]");
    expect(Object.fromEntries(layer.summary()).conductor).toBe("2");
  });
});

describe("the logarithmic embedding", () => {
  it("puts each element on its norm's line, x + y = log|N|, the units on the antidiagonal", () => {
    for (const d of [2, 5, 229]) {
      const layer = quadraticLattice(d, { embedding: "logarithmic" })!;
      for (const [i, j] of layer.addresses!()) {
        const [x, y] = layer.place!(i, j);
        const N = Number(layer.value(i, j, "Norm"));
        expect(x! + y!).toBeCloseTo(Math.log(Math.abs(N)), 9);
      }
      // 1 + √2's powers, φ's: the units, stepping down the antidiagonal by the regulator.
      const unit = layer.addresses!().find(([i, j]) => j !== 0 && layer.has(i, j, "IsUnit"))!;
      const [x] = layer.place!(...unit);
      expect(Math.abs(x!)).toBeGreaterThan(0.4);
    }
  });

  it("is a real field's: an imaginary one has no second |σ|", () => {
    expect(quadraticLattice(-5, { embedding: "logarithmic" })).toBeUndefined();
  });

  it("runs an order's grid along its root when the lattice is square", () => {
    const layer = quadraticLattice(0, { discriminant: -12 })!;
    expect(layer.grid).toEqual([
      [1, 0],
      [1, 1],
    ]);
    expect(layer.gridLabel(1, 2)).toBe("2√−3");
  });
});
