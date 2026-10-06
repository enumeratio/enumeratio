import { describe, expect, it } from "vite-plus/test";
import { FAVORITES, NOTABLE } from "../src/examples.ts";
import { radixLattice } from "../src/radix-lattice.ts";
import {
  expansions,
  formatSettings,
  isCompleteResidueSystem,
  leastResidues,
  parseSettings,
  parseValue,
  RADIX_LIMIT,
} from "../src/radix.ts";

const distinctPoints = (code: string, maxLength: number): [number, number] => {
  const s = parseSettings(code, { maxLength })!;
  const e = expansions({ ...s, maxLength });
  const seen = new Set<string>();
  for (let n = 0; n < e.count; n++) seen.add(`${Math.round(e.ab[2 * n]!)},${Math.round(e.ab[2 * n + 1]!)}`);
  return [seen.size, e.count];
};

describe("values and settings", () => {
  it("parses and prints values in both systems", () => {
    expect(parseValue("-1+i")).toEqual({ value: [-1, 1], system: "i" });
    expect(parseValue("-2-3ω")).toEqual({ value: [-2, -3], system: "ω" });
    expect(parseValue("-ω")).toEqual({ value: [0, -1], system: "ω" });
    expect(parseValue("7")).toEqual({ value: [7, 0] });
    expect(parseValue("1+")).toBeUndefined();
  });

  it("round-trips every favorite's settings sentence", () => {
    for (const f of FAVORITES) {
      const s = parseSettings(f.code, { maxLength: 3 });
      expect([f.code, s !== undefined]).toEqual([f.code, true]);
      const again = parseSettings(formatSettings(s!), { maxLength: 3 })!;
      expect(again).toEqual(s);
    }
  });
});

describe("notable systems", () => {
  it("have one digit per residue class, so their expansions are distinct points", () => {
    for (const e of NOTABLE.filter((e) => e.id !== "quater-imaginary")) {
      const s = parseSettings(e.code, { maxLength: e.maxLength })!;
      expect([e.id, isCompleteResidueSystem(s.system, s.base, s.digits)]).toEqual([e.id, true]);
      const [distinct, count] = distinctPoints(e.code, Math.min(e.maxLength, 6));
      expect([e.id, distinct]).toEqual([e.id, count]);
    }
  });

  it("quater-imaginary: digits 0–3 miss a residue class, yet stay distinct", () => {
    const s = parseSettings(NOTABLE.find((e) => e.id === "quater-imaginary")!.code, { maxLength: 5 })!;
    expect(isCompleteResidueSystem(s.system, s.base, s.digits)).toBe(false);
    const [distinct, count] = distinctPoints(formatSettings(s), 5);
    expect(distinct).toBe(count);
  });

  it("least residues are a complete system", () => {
    for (const [system, base] of [
      ["i", [-1, 1]],
      ["i", [3, 2]],
      ["ω", [3, 1]],
      ["ω", [-2, 3]],
    ] as const) {
      expect(isCompleteResidueSystem(system, base, leastResidues(system, base))).toBe(true);
    }
  });
});

describe("radix layer", () => {
  it("draws the twindragon locked, and the same count unlocked", () => {
    const locked = radixLattice({ example: "twindragon" });
    expect(locked.kind).toBe("lattice");
    expect(locked.points().length).toBe(2 ** 12);
    locked.setControl("locked", "false");
    expect(locked.kind).toBe("points");
    expect(locked.points().length).toBe(2 ** 12);
  });

  it("names the example it shows, and 'custom' once edited", () => {
    const layer = radixLattice({ example: "gosper-island" });
    const choice = () =>
      layer
        .caption()
        .find((p): p is { choice: string; value: string; options: never } => typeof p === "object" && "choice" in p)!;
    expect(choice().value).toBe("gosper-island");
    layer.setControl("add", "");
    expect(choice().value).toBe("custom");
    layer.setControl("example", "twindragon");
    expect(choice().value).toBe("twindragon");
  });

  it("keeps max length within the point budget as digits are added", () => {
    const layer = radixLattice({ example: "twindragon" });
    for (let k = 0; k < 6; k++) layer.setControl("add", "");
    expect(layer.points().length).toBeLessThanOrEqual(RADIX_LIMIT);
  });
});
