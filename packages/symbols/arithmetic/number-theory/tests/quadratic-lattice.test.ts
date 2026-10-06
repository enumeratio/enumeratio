import { describe, expect, it } from "vite-plus/test";
import { CELL, quadraticLattice } from "../src/quadratic-lattice.ts";
import { classify, quadraticRing } from "../src/quadratic.ts";

const CODES = {
  composite: CELL.composite,
  prime: CELL.prime,
  irreducible: CELL.irreducible,
  unit: CELL.unit,
  zero: CELL.zero,
};

describe("quadratic lattice layer", () => {
  it("classifies on doubles as the bigint kernel does", () => {
    for (const d of [-1, -3, -5, -14, -23, 2, 10, 79, 82]) {
      const layer = quadraticLattice(d)!;
      const R = quadraticRing(BigInt(d))!;
      const kind = layer.colorings[0]!;
      // A window near the origin, and one far out where norms pass 2³².
      for (const [ci, cj] of [
        [0, 0],
        [40_000, -31_000],
      ]) {
        for (let i = ci - 6; i <= ci + 6; i++) {
          for (let j = cj - 6; j <= cj + 6; j++) {
            const exact = classify(R, [BigInt(i), BigInt(j)]);
            expect([d, i, j, kind.code(i, j)]).toEqual([d, i, j, exact === undefined ? CELL.unknown : CODES[exact]]);
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
